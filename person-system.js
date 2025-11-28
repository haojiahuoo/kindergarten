// 人员信息管理系统的变量和函数
let personExcelData = [];        //作用：创建一个空数组，用于存储从Excel导入的人员数据,  数据类型：数组(Array)
let selectedKindergarten = '';   // 存储当前选中的幼儿园名称， 字符串(String)
let duplicateIds = new Set();    //作用：创建一个Set集合，用于存储重复的ID，duplicate(复制，重复的意思) 数据类型：Set对象,   特点：Set会自动去重，相同的值只会存储一次，可以快速检查某个ID是否已存在

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    window.lastQueryResults = []; // 初始化查询结果
    // 加载幼儿园数据
    loadKindergarten();
    // 初始化人员拖放功能
    initPersonDragAndDrop();
    // 设置人员事件监听器
    setupPersonEventListeners();
    document.getElementById('preview-section-person').style.display = 'block';
});


async function loadKindergarten() {
    try {
        const response = await fetch('http://localhost/kindergarten/getKindergartens.php');
        const data = await response.json();

        if (data.success) {                         
            const select = document.getElementById('kindergarten-select');
            select.innerHTML = ''; // 清空旧数据

            // 添加默认项
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- 请选择托育机构 --';
            select.appendChild(defaultOption);

            // 添加数据库里的幼儿园
            data.kindergartens.forEach(k => {
                const option = document.createElement('option');
                option.value = k.id;
                option.textContent = k.name;
                select.appendChild(option);
            });

            // 添加 “新建幼儿园” 选项
            const newOption = document.createElement('option');
            newOption.value = 'new';
            newOption.textContent = '++新建托育机构';
            select.appendChild(newOption);
        }
    } catch (err) {
        console.error("加载托育机构失败", err);
    }
}


function setupPersonEventListeners() {
    // 幼儿园选择逻辑
    document.getElementById('kindergarten-select').addEventListener('change', function(e) {
        if (e.target.value === 'new') {
            document.getElementById('new-kindergarten').style.display = 'block';
            selectedKindergarten = '';
        } else {
            document.getElementById('new-kindergarten').style.display = 'none';
            selectedKindergarten = e.target.options[e.target.selectedIndex].text;
        }
        updatePersonImportButton();
    });
    
    document.getElementById('new-kindergarten').addEventListener('input', function(e) {
        selectedKindergarten = e.target.value;
        updatePersonImportButton();
    });
    
    // 文件选择逻辑
    document.getElementById('file-input-person').addEventListener('change', function(e) {
        handlePersonFileSelect(e.target.files);
    });
}

function initPersonDragAndDrop() {
    const dropArea = document.getElementById('drop-area-person');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    dropArea.addEventListener('drop', handlePersonDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropArea.classList.add('dragover');
    }
    
    function unhighlight() {
        dropArea.classList.remove('dragover');
    }
    
    function handlePersonDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handlePersonFileSelect(files);
    }
}

function handlePersonFileSelect(files) {
    if (!selectedKindergarten) {
        showPersonMessage('error-message-person', '请先选择或输入幼儿园名称');
        return;
    }
    
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
        showPersonMessage('error-message-person', '请选择Excel文件（.xls 或 .xlsx）');
        return;
    }
    
    document.getElementById('file-info-person').style.display = 'block';
    document.getElementById('file-name-person').textContent = file.name;
    document.getElementById('file-size-person').textContent = formatFileSize(file.size);
    
    showPersonStatus('正在读取Excel文件...', 30);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
                header: 1,
                defval: null,
                raw: false
            });
            
            // 检查整个数据是否为空
            if (!jsonData || jsonData.length === 0) {
                showPersonMessage('error-message-person', 'Excel文件为空，请检查文件内容');
                hidePersonStatus();
                return;
            }
            
            // 检查是否有有效数据行（只要孩子ID或孩子姓名有一个不为空就算有效）
            let hasValidData = false;
            for (let i = 2; i < jsonData.length; i++) {
                const row = jsonData[i];
                const childIdValue = row && row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '';
                const childNameValue = row && row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
                if (childIdValue !== '' || childNameValue !== '') {
                    hasValidData = true;
                    break;
                }
            }
            
            if (!hasValidData) {
                showPersonMessage('error-message-person', 'Excel文件中没有有效数据（孩子ID和孩子姓名都为空）');
                hidePersonStatus();
                return;
            }
            
            processPersonExcelData(jsonData);
            showPersonStatus('文件读取完成', 100);
            setTimeout(() => hidePersonStatus(), 1000);
            
        } catch (error) {
            hidePersonStatus();
            showPersonMessage('error-message-person', '文件读取失败: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        hidePersonStatus();
        showPersonMessage('error-message-person', '文件读取错误');
    };
    
    reader.readAsArrayBuffer(file);
}

// process(处理)person(人员)excel(excel表)data(数据)
function processPersonExcelData(data) {
    personExcelData = [];
    duplicateIds.clear();
    let hasChildIdError = false;
    let hasFatherIdError = false;
    let hasMotherIdError = false;
    let hasChildNameError = false;
    let hasFatherNameError = false;
    let hasMotherNameError = false;
    let hasBirthOrderError = false;
    
    let childIdErrorMessage = '';
    let fatherIdErrorMessage = '';
    let motherIdErrorMessage = '';
    let childNameErrorMessage = '';
    let fatherNameErrorMessage = '';
    let motherNameErrorMessage = '';
    let birthOrderErrorMessage = '';

    for (let i = 2; i < data.length; i++) {
        const row = data[i];
        // 检查孩子ID和姓名是否同时为空
        const initialChildIdValue = row && row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : '';
        const initialChildNameValue = row && row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : '';
        
        console.log(`第${i}行: childId="${initialChildIdValue}", childName="${initialChildNameValue}"`);
        
        // 只有当孩子ID和孩子姓名同时为空时才跳过该行
        if (initialChildIdValue === '' && initialChildNameValue === '') {
            console.log(`第${i}行被跳过（孩子ID和姓名都为空）`);
            continue; // 跳过这一行
        }
        
        console.log(`第${i}行进入处理逻辑`);
        
        // 确保行有足够的列，如果没有就填充null
        const filledRow = [];
        for (let j = 0; j < 8; j++) {
            filledRow[j] = row[j] !== undefined ? row[j] : null;
        }
        
        // 处理null值，确保trim()不会报错
        const processedChildNameValue = filledRow[1] !== null ? String(filledRow[1]).trim() : '';
        const birthOrderValue = filledRow[2] !== null ? String(filledRow[2]).trim() : '';
        const processedChildIdValue = filledRow[3] !== null ? String(filledRow[3]).trim() : '';
        const fatherNameValue = filledRow[4] !== null ? String(filledRow[4]).trim() : '';
        const fatherIdValue = filledRow[5] !== null ? String(filledRow[5]).trim() : '';
        const motherNameValue = filledRow[6] !== null ? String(filledRow[6]).trim() : '';
        const motherIdValue = filledRow[7] !== null ? String(filledRow[7]).trim() : '';
        
        // 检查孩子姓名验证错误（不能为空）
        if (!hasChildNameError) {
            if (!processedChildNameValue) {
                hasChildNameError = true;
                childNameErrorMessage = '孩子姓名不能为空';
            } else if (processedChildNameValue.length > 50) {
                hasChildNameError = true;
                childNameErrorMessage = '孩子姓名长度不能超过50个字符';
            } else if (!/^[\u4e00-\u9fa5a-zA-Z·]+$/.test(processedChildNameValue)) {
                hasChildNameError = true;
                childNameErrorMessage = '孩子姓名只能包含中文、英文字母和间隔号(·)';
            }
        }
        
        // 检查孩次验证错误（不能为空）
        if (!hasBirthOrderError) {
            if (!birthOrderValue) {
                hasBirthOrderError = true;
                birthOrderErrorMessage = '孩次不能为空';
            } else {
                const num = Number(birthOrderValue);
                const isValidBirthOrder = (num === 2 || num === 3);
                if (!isValidBirthOrder) {
                    hasBirthOrderError = true;
                    birthOrderErrorMessage = '孩次只能填写2或3';
                }
            }
        }
        
        // 检查childId验证错误（必填）
        if (!hasChildIdError) {
            if (!processedChildIdValue) {
                hasChildIdError = true;
                childIdErrorMessage = '婴幼儿身份证号码不能为空';
            } else if (processedChildIdValue.length !== 18) {
                hasChildIdError = true;
                childIdErrorMessage = `婴幼儿身份证号码长度必须为18位，当前长度为${processedChildIdValue.length}`;
            } else if (!/^\d{17}[\dX]$/.test(processedChildIdValue)) {
                hasChildIdError = true;
                childIdErrorMessage = '婴幼儿身份证号码除最后一位以外必须全部为数字，不能包含字母或特殊字符';
            }
        }
        
        // 检查父亲姓名验证错误（不能为空）
        if (!hasFatherNameError) {
            if (!fatherNameValue) {
                hasFatherNameError = true;
                fatherNameErrorMessage = '父亲姓名不能为空';
            } else if (fatherNameValue.length > 50) {
                hasFatherNameError = true;
                fatherNameErrorMessage = '父亲姓名长度不能超过50个字符';
            } else if (!/^[\u4e00-\u9fa5a-zA-Z·]+$/.test(fatherNameValue)) {
                hasFatherNameError = true;
                fatherNameErrorMessage = '父亲姓名只能包含中文、英文字母和间隔号(·)';
            }
        }
        
        // 检查fatherId验证错误（必填）
        if (!hasFatherIdError) {
            if (!fatherIdValue) {
                hasFatherIdError = true;
                fatherIdErrorMessage = '父亲身份证号码不能为空';
            } else if (fatherIdValue.length !== 18) {
                hasFatherIdError = true;
                fatherIdErrorMessage = `父亲身份证号码长度必须为18位，当前长度为${fatherIdValue.length}`;
            } else if (!/^\d{17}[\dX]$/.test(fatherIdValue)) {
                hasFatherIdError = true;
                fatherIdErrorMessage = '父亲身份证号码除最后一位以外必须全部为数字，不能包含字母或特殊字符';
            }
        }
        
        // 检查母亲姓名验证错误（不能为空）
        if (!hasMotherNameError) {
            if (!motherNameValue) {
                hasMotherNameError = true;
                motherNameErrorMessage = '母亲姓名不能为空';
            } else if (motherNameValue.length > 50) {
                hasMotherNameError = true;
                motherNameErrorMessage = '母亲姓名长度不能超过50个字符';
            } else if (!/^[\u4e00-\u9fa5a-zA-Z·]+$/.test(motherNameValue)) {
                hasMotherNameError = true;
                motherNameErrorMessage = '母亲姓名只能包含中文、英文字母和间隔号(·)';
            }
        }
        
        // 检查motherId验证错误（必填）
        if (!hasMotherIdError) {
            if (!motherIdValue) {
                hasMotherIdError = true;
                motherIdErrorMessage = '母亲身份证号码不能为空';
            } else if (motherIdValue.length !== 18) {
                hasMotherIdError = true;
                motherIdErrorMessage = `母亲身份证号码长度必须为18位，当前长度为${motherIdValue.length}`;
            } else if (!/^\d{17}[\dX]$/.test(motherIdValue)) {
                hasMotherIdError = true;
                motherIdErrorMessage = '母亲身份证号码除最后一位以外必须全部为数字，不能包含字母或特殊字符';
            }
        }
        
        const person = {
            serialNumber: filledRow[0] !== null ? String(filledRow[0]) : '',
            childName: processedChildNameValue,
            birthOrder: (() => {
                if (!birthOrderValue) return '';
                const num = Number(birthOrderValue);
                return num === 2 || num === 3 ? num : birthOrderValue;
            })(),
            childId: processedChildIdValue,
            fatherName: fatherNameValue,
            fatherId: fatherIdValue,
            motherName: motherNameValue,
            motherId: motherIdValue,
            isDuplicate: false,
            isDbDuplicate: false,
            hasError: hasBirthOrderError || hasChildIdError || hasFatherIdError || hasMotherIdError || 
                    hasChildNameError || hasFatherNameError || hasMotherNameError
        };
        
        personExcelData.push(person);
    }
    
    checkPersonDuplicates();  // check(检查)person(人)duplicates(副本)，在这个是检查的是之前创建储存人员数据的数组personExcelData
    renderPersonPreview();    // render(渲染)person(人)preview(预览)
    document.getElementById('preview-section-person').style.display = 'block';
    document.getElementById('preview-kindergarten-person').textContent = selectedKindergarten;

    // 根据验证结果更新界面
    let errorMessage = '';

    if (hasChildNameError) {
        errorMessage = childNameErrorMessage;
    } else if (hasBirthOrderError) {
        errorMessage = birthOrderErrorMessage;
    } else if (hasChildIdError) {
        errorMessage = childIdErrorMessage;
    } else if (hasFatherNameError) {
        errorMessage = fatherNameErrorMessage;
    } else if (hasFatherIdError) {
        errorMessage = fatherIdErrorMessage;
    } else if (hasMotherNameError) {
        errorMessage = motherNameErrorMessage;
    } else if (hasMotherIdError) {
        errorMessage = motherIdErrorMessage;
    }

    if (errorMessage) {
        showPersonMessage('error-message-person', errorMessage, 'error');
        disablePersonImportButton();
    } else {
        hidePersonMessage();
        updatePersonImportButton();
    }
}


// check(检查)person(人)duplicates(副本),检查的是之前创建储存人员数据的数组personExcelData
function checkPersonDuplicates() {
    const idMap = {};  // map(直接翻译是地图)

    //(forEach)遍历personExcelData
    personExcelData.forEach(person => {   //箭头回调函数  等同于person=把{}里面计算完都是内容赋值给person
        if (person.childId) {   // 如果person有childId(这个是自己定义的一个变量，孩子ID（D列）)
            /*
            第一次运行的时候 idMap={空的}，
            先运行右边的idMap[person.childId],因为是空的所以是undefined（因为属性不存在）
            idMap是一个{}，[person.childId]是key,  idMap[person.childId]取的是idMap的[person.childId]这是key的value
            undefined || 0 // → 0（因为undefined是假值）
            0 + 1 // → 1
            赋值后：
            idMap[person.childId] = 这个才是给idMap[person.childId]这个key赋值，
            idMap = {
                '371502202210230016': 1  // 现在这个属性存在了，值是1
            }
            */
            idMap[person.childId] = (idMap[person.childId] || 0) + 1;  
        }
    });
    //(forEach)再次遍历personExcelData
    personExcelData.forEach(person => {
        // 如果person有childId,并且idMap[person.childId]大于1(说明有重复的)
        if (person.childId && idMap[person.childId] > 1) {
            person.isDuplicate = true;  //标记为有重复的
            duplicateIds.add(person.childId); //把这个重复的id添加到在最上面创建一个Set集合里
        }
    });
}

// 网页表格渲染
function renderPersonPreview() {
    const tbody = document.getElementById('preview-body-person');
    tbody.innerHTML = '';

    if (personExcelData.length === 0) {
        // 数据为空时显示占位行
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="10" style="text-align:center; color:#999;">暂无数据</td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }

    personExcelData.forEach((person, index) => {
        const row = document.createElement('tr');

        if (person.isDuplicate || person.isDbDuplicate) {
            row.classList.add('duplicate-row');
        }

        // 为每一行设置数据索引，便于后续操作
        row.setAttribute('data-person-index', index);

        // 构建表格行的HTML内容
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="${!person.childName ? 'error-cell' : ''}">${person.childName}</td>
            <td class="birth-order-cell ${!person.birthOrder || (person.birthOrder !== 2 && person.birthOrder !== 3) ? 'error-cell' : ''}">${person.birthOrder}</td>
            <td class="${!person.childId || person.childId.length !== 18 || !/^\d{17}[\dX]$/.test(person.childId) ? 'error-cell' : ''}">${formatIdNumber(person.childId)}</td>
            <td class="${!person.fatherName ? 'error-cell' : ''}">${person.fatherName}</td>
            <td class="${!person.fatherId || person.fatherId.length !== 18 || !/^\d{17}[\dX]$/.test(person.fatherId) ? 'error-cell' : ''}">${formatIdNumber(person.fatherId)}</td>
            <td class="${!person.motherName ? 'error-cell' : ''}">${person.motherName}</td>
            <td class="${!person.motherId || person.motherId.length !== 18 || !/^\d{17}[\dX]$/.test(person.motherId) ? 'error-cell' : ''}">${formatIdNumber(person.motherId)}</td>
            <td>
                ${person.isDuplicate ? '<span style="color:red">Excel重复</span>' : 
                person.isDbDuplicate ? '<span style="color:red">数据库重复</span>' : '正常'}
            </td>
            <td>
                <button class="btn btn-warning" onclick="deletePerson(${index})" style="padding:4px 8px; font-size:12px;">
                    删除
                </button>
            </td>
        `;
        
        // 在行添加到tbody后，为错误单元格添加高亮样式
        const errorCells = row.querySelectorAll('.error-cell');
        errorCells.forEach(cell => {
            cell.style.color = '#d93025';
            cell.style.fontWeight = 'bold';
            cell.style.backgroundColor = '#ffebee';
            cell.style.border = '1px solid #ffcdd2';
            
            // 根据单元格类型设置不同的提示文本
            const cellIndex = Array.from(cell.parentNode.cells).indexOf(cell);
            switch(cellIndex) {
                case 1: // 孩子姓名
                    cell.title = '孩子姓名不能为空';
                    break;
                case 2: // 孩次
                    cell.title = '孩次不能为空或只能为2、3';
                    break;
                case 3: // 孩子身份证
                    if (!person.childId) {
                        cell.title = '婴幼儿身份证号码不能为空';
                    } else if (person.childId.length !== 18) {
                        cell.title = `婴幼儿身份证号码长度必须为18位，当前为${person.childId.length}位`;
                    } else if (!/^\d{17}[\dX]$/.test(person.childId)) {
                        cell.title = '婴幼儿身份证号码除最后一位以外必须为纯数字';
                    }
                    break;
                case 4: // 父亲姓名
                    cell.title = '父亲姓名不能为空';
                    break;
                case 5: // 父亲身份证
                    if (!person.fatherId) {
                        cell.title = '父亲身份证号码不能为空';
                    } else if (person.fatherId.length !== 18) {
                        cell.title = `父亲身份证号码长度必须为18位，当前为${person.fatherId.length}位`;
                    } else if (!/^\d{17}[\dX]$/.test(person.fatherId)) {
                        cell.title = '父亲身份证号码除最后一位以外必须为纯数字';
                    }
                    break;
                case 6: // 母亲姓名
                    cell.title = '母亲姓名不能为空';
                    break;
                case 7: // 母亲身份证
                    if (!person.motherId) {
                        cell.title = '母亲身份证号码不能为空';
                    } else if (person.motherId.length !== 18) {
                        cell.title = `母亲身份证号码长度必须为18位，当前为${person.motherId.length}位`;
                    } else if (!/^\d{17}[\dX]$/.test(person.motherId)) {
                        cell.title = '母亲身份证号码除最后一位以外必须为纯数字';
                    }
                    break;
            }
        });
        
        tbody.appendChild(row);
    });

    if (duplicateIds.size > 0) {
        showPersonMessage('warning-message-person', `检测到 ${duplicateIds.size} 个重复的身份证号（红色标记）`);
    }
}

// 添加CSS样式（可以在页面头部添加）
const style = document.createElement('style');
style.textContent = `
    .error-cell {
        color: #d93025 !important;
        font-weight: bold !important;
        background-color: #ffebee !important;
        border: 1px solid #ffcdd2 !important;
    }
    .error-cell:hover::after {
        content: attr(title);
        position: absolute;
        background: #333;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        margin-top: 20px;
        margin-left: 10px;
    }
`;
document.head.appendChild(style);


// 删除人员函数
function deletePerson(index) {
    if (index >= 0 && index < personExcelData.length) {
        personExcelData.splice(index, 1);
        renderPersonPreview();
        updatePersonImportButton();
    }
}

// 导入(import)人员(person)数据(data)
function importPersonData() {
    if (personExcelData.length === 0) {
        showPersonMessage('error-message-person', '没有数据可导入');
        return;
    }
     // 先获取幼儿园记录数来计算序号
    getKindergartenRecordCount(selectedKindergarten).then(kindergartenCount => {
        const startSerial = (kindergartenCount || 0) + 1;
        
        // 为每条数据分配正确的序号
        personExcelData.forEach((person, index) => {
            person.serialNumber = startSerial + index;
        });
        // 数据(data)代发送(to send)
        const dataToSend = {
            kindergarten: selectedKindergarten,
            persons: personExcelData
        };
        console.log(JSON.stringify(dataToSend)); 
        showPersonStatus('正在导入数据...', 30);
        document.getElementById('import-btn-person').disabled = true;

        fetch('import.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        })
        .then(res => {
            if (!res.ok) throw new Error("HTTP 状态码: " + res.status);
            return res.json();
        })
        .then(data => {
            console.log("导入成功:", data);
            return data;   // 这里必须 return
        })

        .then(result => {
            console.log("返回数据:", result);

            if (result.duplicateIds && result.duplicateIds.length > 0) {
                // 标红
                result.duplicateIds.forEach(id => {
                    personExcelData.forEach(p => { if (p.childId === id) p.isDbDuplicate = true; });
                });
                // 网页表格渲染
                renderPersonPreview();
                updatePersonImportButton();  // 禁用导入
                showPersonMessage('warning-message-person', `检测到重复数据，不允许导入`);
            } else {
                // 保存序号信息用于打印
                window.lastImportSerials = {
                    startSerial: startSerial,
                    count: personExcelData.length
                };
                // 导入成功后自动打印
                printPersonInfo();
                // 清空人员预览数据及相关界面元素
                clearPersonPreview()
                // 网页表格渲染
                renderPersonPreview();
                updatePersonImportButton();

                if (result.success) {
                    showPersonStatus('导入成功', 100);
                    showPersonMessage('success-message', 
                        `导入完成！成功: ${result.stats.success}`);
                         // 只有在成功时才执行清空操作
                        if (onSuccess) {
                            onSuccess();
                    }
                } else {
                    showPersonStatus('导入失败', 0);
                    showPersonMessage('error-message-person', '导入失败: ' + result.message);
                }
            }

            // 延时 2 秒再恢复按钮
            setTimeout(() => {
                hidePersonStatus();
                document.getElementById('import-btn-person').disabled = false;
            }, 2000);

        })
        .catch(error => {
            hidePersonStatus();
            document.getElementById('import-btn-person').disabled = false;
            showPersonMessage('error-message-person', '请求或处理出错: ' + error.message);
        });
    }).catch(error => {
        showPersonMessage('error-message-person', '获取序号失败: ' + error.message);
    });
}
// updata(上传信息)person(人)import(导入)button(按钮)
function updatePersonImportButton() {
    const importBtn = document.getElementById('import-btn-person');
    // 禁用状态（disabled = true）：当以上任意条件满足时，disabled是button的一个属性
    importBtn.disabled = !selectedKindergarten || personExcelData.length === 0 || duplicateIds.size > 0;
}

// 单独添加人员功能
function addSinglePerson() {
    const childName = document.getElementById('child-name').value.trim();
    const birthOrder = parseInt(document.getElementById('birth-order').value); // 转换为数字
    const childId = document.getElementById('child-id').value.trim();
    const fatherName = document.getElementById('father-name').value.trim();
    const fatherId = document.getElementById('father-id').value.trim();
    const motherName = document.getElementById('mother-name').value.trim();
    const motherId = document.getElementById('mother-id').value.trim();
    
    if (!childName) {
        showAddMessage('add-error-message', '请输入孩子姓名');
        return;
    }
    
    if (!birthOrder) {
        showAddMessage('add-error-message', '请选择胎次');
        return;
    }
    
    if (!childId || childId.length !== 18) {
        showAddMessage('add-error-message', '请输入有效的18位身份证号');
        return;
    }
    
    if (!selectedKindergarten) {
        showAddMessage('add-error-message', '请先选择托育机构');
        return;
    }
    
    const isDuplicate = personExcelData.some(person => person.childId === childId);
    if (isDuplicate) {
        showAddMessage('add-error-message', '该身份证号已存在，不能重复添加');
        return;
    }
    
    const newPerson = {
        serialNumber: personExcelData.length + 1,
        childName: childName,
        birthOrder: birthOrder,
        childId: childId,
        fatherName: fatherName,
        fatherId: fatherId,
        motherName: motherName,
        motherId: motherId,
        isDuplicate: false,
        isDbDuplicate: false
    };
    
    personExcelData.push(newPerson)
    renderPersonPreview();
    showAddMessage('add-success-message', '人员添加成功！');
    updatePersonImportButton();
}
function onSuccess(){
    document.getElementById('child-name').value = '';
    document.getElementById('birth-order').value = '';
    document.getElementById('child-id').value = '';
    document.getElementById('father-name').value = '';
    document.getElementById('father-id').value = '';
    document.getElementById('mother-name').value = '';
    document.getElementById('mother-id').value = '';
}
// 辅助函数
// function formatIdNumber(id) {
//     if (!id) return '';
//     if (id.length !== 18) return id;
//     return id.substring(0, 6) + '****' + id.substring(14);
//     return id
// }
function formatIdNumber(id) {
    return id || '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 显示(shuow)人员(person)状态(status)
function showPersonStatus(text, progress) {
    const statusBar = document.getElementById('status-bar-person');
    const statusText = document.getElementById('status-text-person');
    const progressBar = document.getElementById('progress-bar-person');
    if (!statusBar || !statusText || !progressBar) return;
    statusBar.style.display = 'block';
    statusText.textContent = text;
    progressBar.style.width = progress + '%';
}

function hidePersonStatus() {
    document.getElementById('status-bar-person').style.display = 'none';
}

// 显示红色
function showPersonMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;   // 元素不存在直接返回
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 10000);
}

function showAddMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 3000);
}

// 禁用导入按钮
function disablePersonImportButton() {
    const importButton = document.getElementById('import-person-button'); // 请替换为实际的按钮ID
    if (importButton) {
        importButton.disabled = true;
        importButton.style.backgroundColor = '#ccc';
        importButton.style.cursor = 'not-allowed';
    }
}

// // 更新导入按钮状态（在renderPersonPreview或已有的updatePersonImportButton中）
// function updatePersonImportButton() {
//     const importButton = document.getElementById('import-person-button');
//     if (importButton) {
//         const hasErrors = personExcelData.some(person => person.hasError);
//         const hasDuplicates = personExcelData.some(person => person.isDuplicate);
        
//         importButton.disabled = hasErrors || hasDuplicates;
//         importButton.style.backgroundColor = hasErrors || hasDuplicates ? '#ccc' : '';
//         importButton.style.cursor = hasErrors || hasDuplicates ? 'not-allowed' : '';
//     }
// }

// 隐藏错误消息
function hidePersonMessage() {
    const element = document.getElementById('error-message-person');
    if (element) {
        element.style.display = 'none';
    }
}

/**
 * 清空人员预览数据及相关界面元素
 */
function clearPersonPreview() {
    // 1. 清空数据数组
    personExcelData = [];
    
    // 2. 清空重复ID集合
    if (duplicateIds && duplicateIds.clear) {
        duplicateIds.clear();
    }
    // 3. 清空预览表格内容
    const tbody = document.getElementById('preview-body-person');
    if (tbody) {
        tbody.innerHTML = '';
    }
    // 5. 清空文件输入框
    const fileInput = document.getElementById('file-input-person');
    if (fileInput) {
        fileInput.value = '';
    }
    // 6. 隐藏文件信息显示
    const fileInfo = document.getElementById('file-info-person');
    if (fileInfo) {
        fileInfo.style.display = 'none';
    }
    
    loadKindergarten()

    // 8. 更新导入按钮状态
    updatePersonImportButton();
    console.log('人员预览数据已清空');
}

// 综合查询人员函数
function queryPersonData() {
    clearQueryResults();
    
    const childName = document.getElementById('child-name').value.trim();
    const birthOrderValue = document.getElementById('birth-order').value;
    const birthOrder = birthOrderValue ? parseInt(birthOrderValue) : null;
    const childId = document.getElementById('child-id').value.trim();
    const fatherName = document.getElementById('father-name').value.trim();
    const fatherId = document.getElementById('father-id').value.trim();
    const motherName = document.getElementById('mother-name').value.trim();
    const motherId = document.getElementById('mother-id').value.trim();
    
    // 获取幼儿园选择
    const kindergartenSelect = document.getElementById('kindergarten-select');
    const selectedKindergartenId = kindergartenSelect?.value;
    const isNewKindergarten = selectedKindergartenId === 'new';
    
    // 判断是否有查询条件
    const hasQueryConditions = childName || childId || fatherName || fatherId || motherName || motherId || birthOrderValue;
    const hasKindergartenSelected = selectedKindergartenId && !isNewKindergarten;
    
    console.log('查询条件详情:', {
        childName,
        birthOrder,
        childId,
        fatherName,
        fatherId,
        motherName,
        motherId,
        hasQueryConditions,
        hasKindergartenSelected
    });
    
    // 验证：至少需要一个查询条件或选择了幼儿园
    if (!hasQueryConditions && !hasKindergartenSelected) {
        showAddMessage('add-error-message', '请至少输入一个查询条件或选择托育机构');
        return;
    }
    
    // 构建查询参数
    const queryParams = {};
    
    // 情况1：没有查询条件但选择了幼儿园，就查询该幼儿园全部人员
    if (!hasQueryConditions && hasKindergartenSelected) {
        queryParams.kindergarten = selectedKindergartenId;
        console.log('查询幼儿园全部人员参数:', queryParams);
        showPersonStatus('正在查询幼儿园全部人员...', 30);
    } 
    // 情况2：没有选择幼儿园但有查询条件，就查询全部人员中符合条件的
    else if (!hasKindergartenSelected && hasQueryConditions) {
        if (childName) queryParams.childName = childName;
        if (birthOrder) queryParams.birthOrder = birthOrder;
        if (childId) queryParams.childId = childId;
        if (fatherName) queryParams.fatherName = fatherName;
        if (fatherId) queryParams.fatherId = fatherId;
        if (motherName) queryParams.motherName = motherName;
        if (motherId) queryParams.motherId = motherId;
        
        console.log('条件查询全部人员参数:', queryParams);
        showPersonStatus('正在按条件查询全部人员...', 30);
    }
    // 情况3：既有幼儿园选择又有查询条件，就查询该幼儿园中符合条件的
    else if (hasKindergartenSelected && hasQueryConditions) {
        if (childName) queryParams.childName = childName;
        if (birthOrder) queryParams.birthOrder = birthOrder;
        if (childId) queryParams.childId = childId;
        if (fatherName) queryParams.fatherName = fatherName;
        if (fatherId) queryParams.fatherId = fatherId;
        if (motherName) queryParams.motherName = motherName;
        if (motherId) queryParams.motherId = motherId;
        
        queryParams.kindergarten = selectedKindergartenId;
        
        console.log('查询幼儿园中符合条件的参数:', queryParams);
        showPersonStatus('正在查询幼儿园中符合条件的人员...', 30);
    }
    
    // 统一的查询执行逻辑
    fetch('http://localhost/kindergarten/queryPerson.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryParams)
    })
    .then(res => {
        console.log('响应状态:', res.status);
        if (!res.ok) throw new Error("HTTP 状态码: " + res.status);
        return res.json();
    })
    .then(data => {
        console.log("完整查询结果:", data);
        handleQueryResponse(data);
    })
    .catch(error => {
        console.error('查询失败:', error);
        showPersonMessage('error-message-person', '查询失败: ' + error.message);
    })
    .finally(() => {
        hidePersonStatus();
    });
}

// 处理查询响应的统一函数
function handleQueryResponse(data) {
    if (data.success && data.persons && data.persons.length > 0) {
        // 保存查询结果用于打印
        window.lastQueryResults = data.persons;
        // 显示查询结果在预览区域
        displayQueryResults(data.persons);
        showPersonMessage('error-message-person', data.message || `查询到 ${data.persons.length} 条人员信息`);
    } else {
        // 清空之前的查询结果
        window.lastQueryResults = [];
        // 在预览区域显示"未找到数据"
        displayNoResults();
        showPersonMessage('error-message-person', data.message || '未找到符合条件的人员信息');
    }
}
// 显示查询结果
function displayQueryResults(persons) {
    const tbody = document.getElementById('preview-body-person');
    
    // 更新标题显示查询结果
    const kindergartenName = persons[0]?.kindergartenName || selectedKindergarten;
    document.getElementById('preview-kindergarten-person').textContent = 
        `${kindergartenName} - 查询结果 (${persons.length} 条记录)`;
        if (persons.length > 0){
            clearQueryForm()
        }
    tbody.innerHTML = '';
    
    persons.forEach((person, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${person.serialNumber || index + 1}</td>
            <td>${person.childName || ''}</td>
            <td>${person.birthOrder || ''}</td>
            <td>${formatIdNumber(person.childId)}</td>
            <td>${person.fatherName || ''}</td>
            <td>${formatIdNumber(person.fatherId)}</td>
            <td>${person.motherName || ''}</td>
            <td>${formatIdNumber(person.motherId)}</td>
            <td>${person.kindergartenName || ''}</td>
            <td>
                <button class="btn btn-info" onclick="editPerson('${person.childId}')" style="padding:4px 8px; font-size:12px;">
                    编辑
                </button>
                <button class="btn btn-danger" onclick="deletePersonFromDB('${person.childId}')" style="padding:4px 8px; font-size:12px; margin-top:2px;">
                    删除
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // 显示预览区域
    document.getElementById('preview-section-person').style.display = 'block';
}

// 显示无结果信息
function displayNoResults() {
    const tbody = document.getElementById('preview-body-person');
    
    // 更新标题
    document.getElementById('preview-kindergarten-person').textContent = 
        `${selectedKindergarten || '查询'} - 无结果`;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="10" style="text-align:center; color:#999; padding:40px;">
                <i class="fas fa-search" style="font-size:48px; color:#ddd; margin-bottom:10px; display:block;"></i>
                未找到符合条件的人员信息
            </td>
        </tr>
    `;
    
    // 显示预览区域
    document.getElementById('preview-section-person').style.display = 'block';
}

// 清空查询结果
function clearQueryResults() {
    const tbody = document.getElementById('preview-body-person');
    tbody.innerHTML = `
        <tr>
            <td colspan="10" style="text-align:center; color:#999; padding:40px;">
                <i class="fas fa-database" style="font-size:48px; color:#ddd; margin-bottom:10px; display:block;"></i>
                暂无数据
            </td>
        </tr>
    `;
}

// 从数据库删除人员
function deletePersonFromDB(childId) {
    if (!confirm('确定要删除这条人员记录吗？此操作不可恢复！')) {
        return;
    }
    
    showPersonStatus('正在删除...', 30);
    
    fetch('http://localhost/kindergarten/deletePerson.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: childId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showAddMessage('add-success-message', '删除成功');
            // 重新查询刷新列表
            queryPersonData();
        } else {
            showAddMessage('add-error-message', '删除失败: ' + data.message);
        }
    })
    .catch(error => {
        showAddMessage('add-error-message', '删除失败: ' + error.message);
    })
    .finally(() => {
        hidePersonStatus();
    });
}

// 更新打印功能
function printPersonInfo() {
    console.log('=== 打印调试信息 ===');
    console.log('personExcelData:', personExcelData);
    console.log('lastQueryResults:', window.lastQueryResults);
    
    // 优先使用查询结果，如果没有则使用导入数据
    let printData = [];
    let dataSource = ''; // 标识数据来源
    
    if (window.lastQueryResults && window.lastQueryResults.length > 0) {
        console.log('使用查询结果进行打印');
        printData = window.lastQueryResults;
        dataSource = 'query';
    } else if (personExcelData && personExcelData.length > 0) {
        console.log('使用导入数据进行打印');
        printData = personExcelData;
        dataSource = 'import';
    } else {
        console.log('没有可打印的数据');
        showPersonMessage('error-message-person', '没有数据可打印，请先查询或导入数据');
        return;
    }
    
    console.log('最终打印数据:', printData);
    console.log('最终打印数据长度:', printData.length);
    console.log('数据来源:', dataSource);
    
    // 直接使用数据中的 serialNumber（在导入时已计算）
    const printDataWithSerial = printData.map((person, index) => ({
        ...person,
        // 使用数据库中的 serialNumber，如果没有则用索引+1
        correctSerial: person.serialNumber || (index + 1)
    }));
    
    // 计算原有记录数（起始序号-1）
    const startSerial = printDataWithSerial[0]?.correctSerial || 1;
    const originalCount = startSerial - 1;
    
    // 根据数据来源生成不同的统计信息
    const getSummaryHTML = () => {
        if (dataSource === 'import') {
            // 导入数据的统计信息
            return `
            <div class="summary">
                <div class="summary-line">
                    <span class="summary-item"><strong>统计信息：</strong></span>
                    <span class="summary-item">新增记录数: ${printData.length} 条</span>
                    <span class="summary-item">序号范围: ${printDataWithSerial[0]?.correctSerial || 1} - ${printDataWithSerial[printDataWithSerial.length - 1]?.correctSerial || 1}</span>
                    <span class="summary-item">原有记录数: ${originalCount} 条</span>
                    <span class="summary-item">打印时间: ${new Date().toLocaleString()}</span>
                </div>
            </div>
            `;
        } else {
            // 查询数据的统计信息
            return `
            <div class="summary">
                <div class="summary-line">
                    <span class="summary-item"><strong>统计信息：</strong></span>
                    <span class="summary-item">记录数: ${printData.length} 条</span>
                    <span class="summary-item">序号范围: ${printDataWithSerial[0]?.correctSerial || 1} - ${printDataWithSerial[printDataWithSerial.length - 1]?.correctSerial || 1}</span>
                    <span class="summary-item">打印时间: ${new Date().toLocaleString()}</span>
                </div>
            </div>
            `;
        }
    };
    
    // 根据数据来源生成不同的标题
    const getTitle = () => {
        if (dataSource === 'import') {
            return `${selectedKindergarten}新增人员信息表`;
        } else {
            return `${selectedKindergarten}人员信息查询结果`;
        }
    };
    
    // 创建打印窗口
    const printWindow = window.open('', '_blank');
    const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>人员信息报表 - ${selectedKindergarten}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; color: #333; }
            .print-date { text-align: right; color: #666; margin-bottom: 20px; }
            
            /* 竖向表格样式 */
            .vertical-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 10px;
                font-size: 14px;
            }
            .vertical-table th, .vertical-table td { 
                border: 1px solid #ddd; 
                padding: 10px 8px; 
                text-align: left; 
                vertical-align: top;
            }
            .vertical-table th { 
                background-color: #f5f5f5; 
                font-weight: bold; 
                width: 12%; 
                text-align: center;
            }
            .vertical-table td { 
                width: 13%; 
                text-align: center;
            }
            .person-row { 
                border-bottom: 2px solid #333;
            }
            
            /* 统计信息一行显示 */
            .summary { 
                margin-top: 20px; 
                padding: 12px; 
                background-color: #f5f5f5; 
                border-radius: 4px; 
                border: 1px solid #ddd;
                font-size: 14px;
            }
            .summary-line {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
            }
            .summary-item {
                margin: 0 10px;
                white-space: nowrap;
            }
            @media print {
                body { margin: 15mm; }
                .no-print { display: none; }
                .person-row { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${getTitle()}</h1>
        </div>
        <div class="print-date">
            打印时间: ${new Date().toLocaleString()}
        </div>
        
        <table class="vertical-table">
            <thead>
                <tr>
                    <th>序号</th>
                    <th>孩子姓名</th>
                    <th>孩次</th>
                    <th>孩子身份证号</th>
                    <th>父亲姓名</th>
                    <th>父亲身份证号</th>
                    <th>母亲姓名</th>
                    <th>母亲身份证号</th>
                </tr>
            </thead>
            <tbody>
                ${printDataWithSerial.map(person => `
                    <tr class="person-row">
                        <td>${person.correctSerial}</td>
                        <td>${person.childName || ''}</td>
                        <td>${person.birthOrder || ''}</td>
                        <td>${formatIdNumber(person.childId)}</td>
                        <td>${person.fatherName || ''}</td>
                        <td>${formatIdNumber(person.fatherId)}</td>
                        <td>${person.motherName || ''}</td>
                        <td>${formatIdNumber(person.motherId)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        ${getSummaryHTML()}
        
        <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px;">
                打印报表
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 5px;">
                关闭窗口
            </button>
        </div>
    </body>
    </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // 自动触发打印
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// 获取选定幼儿园的总记录数
function getKindergartenRecordCount(kindergartenName) {
    return fetch('http://localhost/kindergarten/getKindergartenCount.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kindergarten: kindergartenName })
    })
    .then(res => {
        if (!res.ok) throw new Error("HTTP 状态码: " + res.status);
        return res.json();
    })
    .then(data => {
        if (data.success) {
            return data.kindergartenCount || 0;
        } else {
            throw new Error(data.message || '获取幼儿园记录数失败');
        }
    });
}
// 清空查询表单
function clearQueryForm() {
    document.getElementById('child-name').value = '';
    document.getElementById('birth-order').value = '';
    document.getElementById('child-id').value = '';
    document.getElementById('father-name').value = '';
    document.getElementById('father-id').value = '';
    document.getElementById('mother-name').value = '';
    document.getElementById('mother-id').value = '';
    
    // 清空预览区域
    clearQueryResults();
    document.getElementById('preview-kindergarten-person').textContent = '查询结果';
    
    // 使用现有的showPersonMessage显示成功消息
    showPersonMessage('error-message-person', '查询条件已清空');
}

// 编辑人员信息
function editPerson(childId) {
    // 从查询结果中找到要编辑的人员
    const personToEdit = window.lastQueryResults.find(person => person.childId === childId);
    
    if (!personToEdit) {
        showPersonMessage('error-message-person', '未找到要编辑的人员信息');
        return;
    }
    
    // 创建编辑模态框
    createEditModal(personToEdit);
}

// 创建编辑模态框 - 修改后的版本
function createEditModal(person) {
    // 移除已存在的模态框
    const existingModal = document.getElementById('edit-person-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 创建模态框HTML
    const modalHTML = `
        <div id="edit-person-modal" class="modal" style="display:block; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.5);">
            <div class="modal-content" style="background-color:#fefefe; margin:5% auto; padding:20px; border:1px solid #888; width:80%; max-width:600px; border-radius:8px;">
                <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:20px;">
                    <h2 style="margin:0; color:#333;">编辑人员信息</h2>
                    <span class="close" onclick="closeEditModal()" style="font-size:28px; font-weight:bold; cursor:pointer; color:#aaa;">&times;</span>
                </div>
                
                <div class="modal-body">
                    <form id="edit-person-form">
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">孩子姓名:</label>
                            <input type="text" id="edit-child-name" value="${person.childName || ''}" 
                                   style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">孩次:</label>
                            <select id="edit-birth-order" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                                <option value="">请选择</option>
                                <option value="2" ${person.birthOrder == 2 ? 'selected' : ''}>2</option>
                                <option value="3" ${person.birthOrder == 3 ? 'selected' : ''}>3</option>
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">孩子身份证号:</label>
                            <input type="text" id="edit-child-id" value="${person.childId || ''}" 
                                   style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                            <small style="color:#666;">修改身份证号将同步更新所有相关记录</small>
                        </div>
                        
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">父亲姓名:</label>
                            <input type="text" id="edit-father-name" value="${person.fatherName || ''}" 
                                   style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">父亲身份证号:</label>
                            <input type="text" id="edit-father-id" value="${person.fatherId || ''}" 
                                   style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">母亲姓名:</label>
                            <input type="text" id="edit-mother-name" value="${person.motherName || ''}" 
                                   style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom:20px;">
                            <label style="display:block; margin-bottom:5px; font-weight:bold;">母亲身份证号:</label>
                            <input type="text" id="edit-mother-id" value="${person.motherId || ''}" 
                                   style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                        </div>
                        
                        <div id="edit-error-message" style="color:red; margin-bottom:15px; display:none;"></div>
                        
                        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #ddd; padding-top:15px;">
                            <button type="button" onclick="closeEditModal()" 
                                    style="padding:8px 16px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer;">
                                取消
                            </button>
                            <button type="button" onclick="submitEditPerson('${person.childId}')" 
                                    style="padding:8px 16px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer;">
                                保存修改
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// 关闭编辑模态框
function closeEditModal() {
    const modal = document.getElementById('edit-person-modal');
    if (modal) {
        modal.remove();
    }
}

// 提交编辑信息 - 添加更好的错误处理
function submitEditPerson(originalChildId) {
    // 获取表单数据
    const childName = document.getElementById('edit-child-name').value.trim();
    const birthOrder = document.getElementById('edit-birth-order').value;
    const childId = document.getElementById('edit-child-id').value.trim();
    const fatherName = document.getElementById('edit-father-name').value.trim();
    const fatherId = document.getElementById('edit-father-id').value.trim();
    const motherName = document.getElementById('edit-mother-name').value.trim();
    const motherId = document.getElementById('edit-mother-id').value.trim();
    
    // 验证必填字段
    const errorMessage = document.getElementById('edit-error-message');
    
    if (!childName) {
        showEditMessage('孩子姓名不能为空');
        return;
    }
    
    if (!birthOrder) {
        showEditMessage('请选择孩次');
        return;
    }
    
    if (!childId) {
        showEditMessage('孩子身份证号不能为空');
        return;
    }
    
    if (!fatherName) {
        showEditMessage('父亲姓名不能为空');
        return;
    }
    
    if (!fatherId) {
        showEditMessage('父亲身份证号不能为空');
        return;
    }
    
    if (!motherName) {
        showEditMessage('母亲姓名不能为空');
        return;
    }
    
    if (!motherId) {
        showEditMessage('母亲身份证号不能为空');
        return;
    }
    
    // 验证身份证格式
    if (childId && (childId.length !== 18 || !/^\d{17}[\dX]$/.test(childId))) {
        showEditMessage('孩子身份证号格式不正确');
        return;
    }
    
    if (fatherId && (fatherId.length !== 18 || !/^\d{17}[\dX]$/.test(fatherId))) {
        showEditMessage('父亲身份证号格式不正确');
        return;
    }
    
    if (motherId && (motherId.length !== 18 || !/^\d{17}[\dX]$/.test(motherId))) {
        showEditMessage('母亲身份证号格式不正确');
        return;
    }
    
    // 构建更新数据
    const updateData = {
        originalChildId: originalChildId,
        childName: childName,
        birthOrder: parseInt(birthOrder),
        childId: childId,
        fatherName: fatherName,
        fatherId: fatherId,
        motherName: motherName,
        motherId: motherId
    };
    
    console.log('提交更新数据:', updateData);
    
    // 显示加载状态
    showPersonStatus('正在更新人员信息...', 30);
    
    // 发送更新请求
    fetch('http://localhost/kindergarten/updatePerson.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    })
    .then(async res => {
        // 先获取响应文本
        const responseText = await res.text();
        console.log('原始响应:', responseText);
        
        try {
            // 尝试解析为JSON
            const data = JSON.parse(responseText);
            return data;
        } catch (parseError) {
            console.error('JSON解析错误:', parseError);
            throw new Error('服务器返回了无效的JSON格式: ' + responseText.substring(0, 100));
        }
    })
    .then(data => {
        console.log("更新响应:", data);
        
        if (data.success) {
            showPersonStatus('更新成功', 100);
            showPersonMessage('error-message-person', '人员信息更新成功', 'success');
            
            // 关闭模态框
            closeEditModal();
            
            // 只更新修改的那条记录，不重新查询
            updateSingleRecordInView(data.updatedRecord || {
                childId: childId, // 新的身份证号
                childName: childName,
                birthOrder: birthOrder,
                fatherName: fatherName,
                fatherId: fatherId,
                motherName: motherName,
                motherId: motherId
            }, originalChildId);
            
        } else {
            showPersonStatus('更新失败', 0);
            showEditMessage(data.message || '更新失败');
        }
    })
    .catch(error => {
        console.error('更新失败:', error);
        showPersonStatus('更新失败', 0);
        showEditMessage('更新失败: ' + error.message);
    })
    .finally(() => {
        setTimeout(() => {
            hidePersonStatus();
        }, 2000);
    });
}

// 更新单条记录在视图中的显示
function updateSingleRecordInView(updatedRecord, originalChildId) {
    const tbody = document.getElementById('preview-body-person');
    const rows = tbody.getElementsByTagName('tr');
    
    for (let row of rows) {
        const childIdCell = row.cells[3]; // 身份证号在第4列
        if (childIdCell && childIdCell.textContent === originalChildId) {
            // 更新这一行的数据
            row.cells[1].textContent = updatedRecord.childName || ''; // 孩子姓名
            row.cells[2].textContent = updatedRecord.birthOrder || ''; // 孩次
            row.cells[3].textContent = updatedRecord.childId || ''; // 孩子身份证
            row.cells[4].textContent = updatedRecord.fatherName || ''; // 父亲姓名
            row.cells[5].textContent = formatIdNumber(updatedRecord.fatherId); // 父亲身份证
            row.cells[6].textContent = updatedRecord.motherName || ''; // 母亲姓名
            row.cells[7].textContent = formatIdNumber(updatedRecord.motherId); // 母亲身份证
            
            // 更新编辑按钮的onclick事件，使用新的身份证号
            const editButton = row.cells[9].querySelector('.btn-info');
            if (editButton) {
                editButton.setAttribute('onclick', `editPerson('${updatedRecord.childId}')`);
            }
            break;
        }
    }
    
    // 同时更新 lastQueryResults 中的数据
    if (window.lastQueryResults) {
        const recordIndex = window.lastQueryResults.findIndex(p => p.childId === originalChildId);
        if (recordIndex !== -1) {
            window.lastQueryResults[recordIndex] = {
                ...window.lastQueryResults[recordIndex],
                ...updatedRecord
            };
        }
    }
}

// 显示编辑错误消息
function showEditMessage(message) {
    const errorElement = document.getElementById('edit-error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 3000);
    }
}

// 点击模态框外部关闭
document.addEventListener('click', function(event) {
    const modal = document.getElementById('edit-person-modal');
    if (modal && event.target === modal) {
        closeEditModal();
    }
});
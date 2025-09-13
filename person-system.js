// 人员信息管理系统的变量和函数
let personExcelData = [];
let selectedKindergarten = '';
let duplicateIds = new Set();

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    loadKindergarten();
    initPersonDragAndDrop();
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
            selectedKindergarten = e.target.value;
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
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
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

function processPersonExcelData(data) {
    personExcelData = [];
    duplicateIds.clear();
    
    for (let i = 2; i < data.length; i++) {
        const row = data[i];
        if (row && row.length >= 8 && row[1]) {
            const person = {
                serialNumber: row[0] || '',
                childName: row[1] || '',
                birthOrder: row[2] || '',
                childId: String(row[3] || '').trim(),
                fatherName: row[4] || '',
                fatherId: String(row[5] || '').trim(),
                motherName: row[6] || '',
                motherId: String(row[7] || '').trim(),
                isDuplicate: false,
                isDbDuplicate: false
            };
            
            personExcelData.push(person);
        }
    }
    
    checkPersonDuplicates();
    renderPersonPreview();
    document.getElementById('preview-section-person').style.display = 'block';
    document.getElementById('preview-kindergarten-person').textContent = selectedKindergarten;
    updatePersonImportButton();
}

function checkPersonDuplicates() {
    const idMap = {};
    
    personExcelData.forEach(person => {
        if (person.childId) {
            idMap[person.childId] = (idMap[person.childId] || 0) + 1;
        }
    });
    
    personExcelData.forEach(person => {
        if (person.childId && idMap[person.childId] > 1) {
            person.isDuplicate = true;
            duplicateIds.add(person.childId);
        }
    });
}

function renderPersonPreview() {
    const tbody = document.getElementById('preview-body-person');
    tbody.innerHTML = '';

    if (personExcelData.length === 0) {
        // 数据为空时显示占位行
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="8" style="text-align:center; color:#999;">暂无数据</td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }

    personExcelData.forEach((person, index) => {
        const row = document.createElement('tr');

        if (person.isDuplicate || person.isDbDuplicate) {
            row.classList.add('duplicate-row');
        }

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${person.childName}</td>
            <td>${person.birthOrder}</td>
            <td>${formatIdNumber(person.childId)}</td>
            <td>${person.fatherName}</td>
            <td>${person.motherName}</td>
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
        tbody.appendChild(row);
    });

    if (duplicateIds.size > 0) {
        showPersonMessage('warning-message-person', `检测到 ${duplicateIds.size} 个重复的身份证号（红色标记）`);
    }
}


// 删除人员函数
function deletePerson(index) {
    if (index >= 0 && index < personExcelData.length) {
        personExcelData.splice(index, 1);
        renderPersonPreview();
        updatePersonImportButton();
    }
}


function importPersonData() {
    if (personExcelData.length === 0) {
        showPersonMessage('error-message-person', '没有数据可导入');
        return;
    }
    
    
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

            renderPersonPreview();
            updatePersonImportButton();  // 禁用导入
            showPersonMessage('warning-message-person', `检测到重复数据，不允许导入`);
        } else {
            renderPersonPreview();
            updatePersonImportButton();

            if (result.success) {
                showPersonStatus('导入成功', 100);
                showPersonMessage('success-message', 
                    `导入完成！成功: ${result.stats.success}`);
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

}

function updatePersonImportButton() {
    const importBtn = document.getElementById('import-btn-person');
    importBtn.disabled = !selectedKindergarten || personExcelData.length === 0 || duplicateIds.size > 0;
}

// 单独添加人员功能
function addSinglePerson() {
    const childName = document.getElementById('child-name').value.trim();
    const birthOrder = document.getElementById('birth-order').value;
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
    
    personExcelData.push(newPerson);
    renderPersonPreview();
    
    document.getElementById('child-name').value = '';
    document.getElementById('birth-order').value = '';
    document.getElementById('child-id').value = '';
    document.getElementById('father-name').value = '';
    document.getElementById('father-id').value = '';
    document.getElementById('mother-name').value = '';
    document.getElementById('mother-id').value = '';
    
    showAddMessage('add-success-message', '人员添加成功！');
    updatePersonImportButton();
}

// 辅助函数
function formatIdNumber(id) {
    if (!id) return '';
    if (id.length !== 18) return id;
    return id.substring(0, 6) + '****' + id.substring(14);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

function showPersonMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;   // 元素不存在直接返回
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
}

function showAddMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 3000);
}

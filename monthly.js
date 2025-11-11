/**
 * 月度报表管理系统
 * 功能：Excel文件导入、数据验证、预览展示、数据导入
 */

// ==================== 全局变量声明 ====================
let excelData = [];           // 存储从Excel解析的数据
let selectedYear = 2025;      // 当前选中的年份
let selectedMonth = 7;        // 当前选中的月份
let validationResults = [];   // 存储数据验证结果
let holidayData = [];         // 存储节假日数据

// ==================== 初始化函数 ====================

/**
 * 页面初始化
 */
document.addEventListener('DOMContentLoaded', function() {
    loadKindergartens();          // 加载托育机构列表
    initDragAndDrop();            // 初始化拖拽功能
    setupEventListeners();        // 设置事件监听器
    updateSelectedDate();         // 更新选中日期显示
    loadHolidayData();            // 加载节假日数据
    document.getElementById('preview-section-monthly').style.display = 'block';
});

/**
 * 加载托育机构列表
 */
async function loadKindergartens() {
    try {
        const response = await fetch('http://localhost/kindergarten/getKindergartens.php');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('kindergarten-select-monthly');
            select.innerHTML = ''; // 清空旧数据

            // 添加默认选项
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- 请选择托育机构 --';
            select.appendChild(defaultOption);

            // 添加数据库中的托育机构
            data.kindergartens.forEach(k => {
                const option = document.createElement('option');
                option.value = k.id;
                option.textContent = k.name;
                select.appendChild(option);
            });

            // 添加新建托育机构选项
            const newOption = document.createElement('option');
            newOption.value = 'new';
            newOption.textContent = '++新建托育机构';
            select.appendChild(newOption);
        }
    } catch (err) {
        console.error("加载托育机构失败", err);
    }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 年份选择变化事件
    document.getElementById('year-select').addEventListener('change', async function(e) {
        selectedYear = parseInt(e.target.value);
        updateSelectedDate();
        if (excelData.length > 0) await validateData();
    });
    
    // 月份选择变化事件
    document.getElementById('month-select').addEventListener('change', async function(e) {
        selectedMonth = parseInt(e.target.value);
        updateSelectedDate();
        if (excelData.length > 0) await validateData();
    });
    
    // 文件选择变化事件
    document.getElementById('file-input-monthly').addEventListener('change', function(e) {
        handleFileSelect(e.target.files);
    });
}

/**
 * 更新选中日期显示
 */
function updateSelectedDate() {
    document.getElementById('selected-date').textContent = `${selectedYear}年${selectedMonth}月`;
}

// ==================== 文件处理函数 ====================

/**
 * 初始化拖拽功能
 */
function initDragAndDrop() {
    const dropArea = document.getElementById('drop-area-monthly');
    
    // 阻止浏览器默认行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // 拖拽进入时高亮显示
    ['dragenter', 'dragover'].forEach(eventName => dropArea.addEventListener(eventName, highlight, false));
    
    // 拖拽离开时取消高亮
    ['dragleave', 'drop'].forEach(eventName => dropArea.addEventListener(eventName, unhighlight, false));
    
    // 处理文件放下事件
    dropArea.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() { dropArea.classList.add('dragover'); }
    function unhighlight() { dropArea.classList.remove('dragover'); }
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFileSelect(files);
    }
}

/**
 * 处理文件选择
 * @param {FileList} files - 选择的文件列表
 */
function handleFileSelect(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // 验证文件类型
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
        showMessage('error-message-monthly', '请选择Excel文件（.xls 或 .xlsx）');
        return;
    }
    
    // 显示文件信息
    document.getElementById('file-info-monthly').style.display = 'block';
    document.getElementById('file-name-monthly').textContent = file.name;
    showStatus('正在读取Excel文件...', 30);

    // 读取文件内容
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            processExcelData(jsonData);
            showStatus('文件读取完成', 100);
            setTimeout(hideStatus, 1000);
        } catch (error) {
            hideStatus();
            showMessage('error-message-monthly', '文件读取失败: ' + error.message);
        }
    };
    reader.onerror = function() {
        hideStatus();
        showMessage('error-message-monthly', '文件读取错误');
    };
    reader.readAsArrayBuffer(file);
}

/**
 * 处理Excel数据
 * @param {Array} data - Excel解析后的数据
 */
function processExcelData(data) {
    excelData = [];
    validationResults = [];
    
    // 从第3行开始遍历（跳过表头）
    for (let i = 2; i < data.length; i++) {
        const row = data[i];
        // 检查婴幼儿姓名和身份证号码是否同时为空
        const name = row[1] || '';
        const idNumber = String(row[3] || '').trim();
        
        // 如果姓名和身份证同时为空，跳过该行
        if (!name && !idNumber) {
            continue;
        }
        
        // 确保行有足够的数据列
        if (row && row.length >= 12) {
            const person = {
                name: name,
                birthOrder: row[2] || '',
                idNumber: idNumber,
                parentName: row[4] || '',
                productType: row[5] || '',
                className: row[6] || '',
                entryDate: parseExcelDate(row[7]),
                paymentDate: parseExcelDate(row[8]),
                paymentAmount: parseFloat(row[9]),
                paymentMonths: parseInt(row[10]),
                monthlyFee: parseFloat(row[11]),
                attendanceDays: parseInt(row[12])
            };
            excelData.push(person);
        }
    }
    
    // 显示预览区域并启用验证按钮
    document.getElementById('preview-section-monthly').style.display = 'block';
    document.getElementById('validate-btn-monthly').disabled = false;
    updateButtons();
    validateData();
}

// ==================== 日期处理函数 ====================

/**
 * 解析Excel日期格式
 * @param {*} value - 原始日期值
 * @returns {string} 格式化后的日期字符串 (YYYYMMDD)
 */
function parseExcelDate(value) {
    if (!value) return '';

    let str = value.toString().trim();

    // 去掉 + 前缀
    if (str.startsWith('+')) str = str.slice(1);

    // 纯数字处理（Excel序列日期）
    if (/^\d+$/.test(str)) {
        const num = Number(str);

        // Excel 序列日期通常在 1900 年之后，值大于 30
        if (num > 30 && num < 2958465) { 
            return excelSerialToYMD(num);
        }

        // UNIX 时间戳处理
        if (num > 1000000000 && num < 10000000000000) {
            let date;
            if (num < 10000000000) {
                date = new Date(num * 1000); // 秒级
            } else {
                date = new Date(num); // 毫秒级
            }
            return formatDateYMD(date);
        }

        return str; // 其他数字直接返回
    }

    // 处理带 - 或 / 的字符串日期
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
        const parts = str.split(/[-/]/);
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, '0');
        const dd = parts[2].padStart(2, '0');
        return `${yyyy}${mm}${dd}`;
    }

    // 尝试 Date 构造
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return formatDateYMD(d);
    }

    return str;
}

/**
 * Excel序列日期转YYYYMMDD格式
 * @param {number} serial - Excel序列日期
 * @returns {string} 格式化日期
 */
function excelSerialToYMD(serial) {
    const excelEpoch = new Date(1899, 11, 30); // Excel起始日期
    const days = Math.floor(serial);
    const milliseconds = (serial - days) * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + milliseconds);
    return formatDateYMD(date);
}

/**
 * 格式化日期为YYYYMMDD
 * @param {Date} date - 日期对象
 * @returns {string} 格式化日期
 */
function formatDateYMD(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

// ==================== 数据验证函数 ====================

/**
 * 主验证函数
 */
async function validateData() {
    if (excelData.length === 0) return;

    showStatus('正在验证数据...', 30);
    validationResults = [];

    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    // 计算工作日和半日工作标准
    const workdaysInMonth = calculateWorkdays(selectedYear, selectedMonth);
    const halfWorkdays = Math.floor(workdaysInMonth / 2);

    // 逐条验证数据
    for (let index = 0; index < excelData.length; index++) {
        const person = excelData[index];
        const result = { index, errors: [], warnings: [], status: 'success' };

        // 基础数据验证
        validateBasicData(person, result);
        
        // 数据库检查
        const dbCheck = await checkChildInDatabase(person.name, person.idNumber);
        if (!dbCheck.ok) {
            result.errors.push(dbCheck.message);
        } 
        // 检查孩次一致性
        else if (!await checkBirthOrderConsistency(person.name, person.idNumber, person.birthOrder)) {
            result.errors.push(`孩次与信息库中不符`);
        }
    
        // 年龄检查
        const ageCheck = checkAgeLimit(person.idNumber, selectedYear, selectedMonth);
        if (ageCheck === 'exceeded') result.errors.push(`已超过3周岁`);
        else if (ageCheck === 'reaching') result.warnings.push(`将在本月超过3周岁`);

        // 费用标准检查
        if (!checkFeeStandard(person.className, person.monthlyFee)) {
            const standard = getFeeStandard(person.className);
            result.errors.push(`收费超标，不应超（标准: ${standard}元）`);
        }

        // 出勤天数检查
        if (person.attendanceDays > 0 && person.attendanceDays < halfWorkdays) {
            result.errors.push(`出勤不足（需${halfWorkdays}天）`);
        }

        // 统计验证状态
        if (result.errors.length > 0) {
            result.status = 'error';
            errorCount++;
        } else if (result.warnings.length > 0) {
            result.status = 'warning';
            warningCount++;
        } else {
            result.status = 'success';
            successCount++;
        }

        validationResults.push(result);
    }

    // 更新界面
    renderPreview();
    updateValidationSummaryMonthly(successCount, warningCount, errorCount);
    showStatus('验证完成', 100);
    setTimeout(() => hideStatus(), 1000);
    updateButtons();
}

/**
 * 基础数据验证
 * @param {Object} person - 人员数据
 * @param {Object} result - 验证结果对象
 */
function validateBasicData(person, result) {
    // 必填字段检查
    if (!person.name) result.errors.push('婴幼儿姓名不能为空');
    
    // 孩次验证
    if (!person.birthOrder) {
        result.errors.push('孩次不能为空');
    } else if (person.birthOrder != 2 && person.birthOrder != 3) {
        result.errors.push('孩次只能填写2或3');
    }
    
    // 身份证验证
    if (!person.idNumber) {
        result.errors.push('身份证号码不能为空');
    } else if (person.idNumber.length < 18) {
        result.errors.push(`身份证号码长度不能少于18位，当前为${person.idNumber.length}位`);
    }
    
    // 家长姓名验证
    if (!person.parentName) result.errors.push('家长姓名不能为空');
    
    // 托育产品验证
    if (!person.productType) {
        result.errors.push('托育产品不能为空');
    } else if (!['全日托', '半日托', '临时托', '计时托'].includes(person.productType)) {
        result.errors.push('托育产品只能是：全日托、半日托、临时托、计时托');
    }
    
    // 班级验证
    if (!person.className) {
        result.errors.push('班级不能为空');
    } else if (!['托大班', '托小班', '乳儿班'].includes(person.className)) {
        result.errors.push('班级只能是：托大班、托小班、乳儿班');
    }
    
    // 其他必填字段验证
    if (!person.entryDate) result.errors.push('入托时间不能为空');
    if (!person.paymentDate) result.errors.push('本次缴费时间不能为空');
    if (!person.paymentAmount && person.paymentAmount !== 0) result.errors.push('本次缴费不能为空');
    if (!person.paymentMonths && person.paymentMonths !== 0) result.errors.push('费用时长不能为空');
    if (!person.monthlyFee && person.monthlyFee !== 0) result.errors.push('单月费用不能为空');
    if (!person.attendanceDays && person.attendanceDays !== 0) result.errors.push('出勤天数不能为空');
}

// ==================== 数据库验证函数 ====================

/**
 * 检查幼儿在数据库中的存在性
 * @param {string} name - 幼儿姓名
 * @param {string} idNumber - 身份证号码
 * @returns {Object} 检查结果
 */
async function checkChildInDatabase(name, idNumber) {
    const selectedKindergarten = document.getElementById('kindergarten-select-monthly').value;
    try {
        const res = await fetch('http://localhost/kindergarten/checkChild.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, idNumber, kindergartenId: selectedKindergarten })
        });
        const data = await res.json();
        
        if (!data.success) return { ok: false, message: "服务器错误" };

        if (data.exists) {
            return { ok: true };  // 存在且幼儿园匹配
        } else {
            if (data.reason === "not_found") {
                return { ok: false, message: "信息库中无此幼儿" };
            } else if (data.reason === "wrong_kindergarten") {
                return { ok: false, message: "此幼儿不在当前幼儿园" };
            } else {
                return { ok: false, message: "未知错误" };
            }
        }
    } catch (err) {
        console.error(err);
        return { ok: false, message: "网络请求失败" };
    }
}

/**
 * 检查孩次一致性
 * @param {string} name - 幼儿姓名
 * @param {string} idNumber - 身份证号码
 * @param {number} birthOrder - 孩次
 * @returns {boolean} 是否一致
 */
async function checkBirthOrderConsistency(name, idNumber, birthOrder) {
    try {
        const res = await fetch('http://localhost/kindergarten/checkBirthOrder.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, idNumber, birthOrder })
        });
        const data = await res.json();
        return data.success && data.match;
    } catch (err) {
        console.error(err);
        return false;
    }
}

// ==================== 业务逻辑验证函数 ====================

/**
 * 检查年龄限制
 * @param {string} idNumber - 身份证号码
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {string} 年龄状态
 */
function checkAgeLimit(idNumber, year, month) {
    if (!idNumber || idNumber.length !== 18) return 'invalid';

    const birthYear = parseInt(idNumber.substring(6, 10), 10);
    const birthMonth = parseInt(idNumber.substring(10, 12), 10);

    // 计算年龄（基于年份和月份）
    let ageInMonths = (year - birthYear) * 12 + (month - birthMonth);
    
    if (ageInMonths > 36) {
        return 'exceeded'; // 超过36个月（3年）
    } else if (ageInMonths === 36) {
        return 'reaching'; // 正好36个月（3年）
    } else {
        return 'valid'; // 小于36个月
    }
}

/**
 * 获取费用标准
 * @param {string} className - 班级名称
 * @returns {number} 费用标准
 */
function getFeeStandard(className) {
    const standards = { '托大班': 1400, '托小班': 1700, '乳儿班': 2100 };
    for (const [key, fee] of Object.entries(standards)) {
        if (className.includes(key)) return fee;
    }
    return 0;
}

/**
 * 检查费用标准
 * @param {string} className - 班级名称
 * @param {number} monthlyFee - 月费用
 * @returns {boolean} 是否符合标准
 */
function checkFeeStandard(className, monthlyFee) {
    const standard = getFeeStandard(className);
    return standard === 0 || monthlyFee <= standard;
}

// ==================== 工作日计算函数 ====================

/**
 * 加载节假日数据
 */
async function loadHolidayData() {
    try {
        const res = await fetch('holidays2025.json');
        holidayData = await res.json();
    } catch (err) {
        console.error('加载节假日数据失败:', err);
        holidayData = [];
    }
}

/**
 * 判断某一天是否是工作日
 * @param {Date} date - 日期对象
 * @returns {boolean} 是否是工作日
 */
function isWorkday(date) {
    const dStr = date.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const dayInfo = holidayData.find(h => h.day === dStr);
    if (!dayInfo) {
        // JSON 中没有记录的，默认周一到周五为工作日
        const wd = date.getDay();
        return wd !== 0 && wd !== 6; // 0=周日, 6=周六
    }
    return dayInfo.type === 0; // 0=工作日
}

/**
 * 计算指定年月工作日数量
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {number} 工作日天数
 */
function calculateWorkdays(year, month) {
    let count = 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, month - 1, d);
        if (isWorkday(dt)) count++;
    }
    return count;
}

// ==================== 界面渲染函数 ====================

/**
 * 渲染预览表格
 */
function renderPreview() {
    const tbody = document.getElementById('preview-body-monthly');
    tbody.innerHTML = '';
    
    excelData.forEach((person, index) => {
        const result = validationResults[index];
        const row = document.createElement('tr');
        
        // 根据验证状态添加CSS类
        if (result.status === 'error') row.classList.add('error-row');
        else if (result.status === 'warning') row.classList.add('warning-row');
        else row.classList.add('success-row');
        
        const allMessages = [...result.errors, ...result.warnings].join('；');
        
        // 为每个单元格添加错误类
        const nameClass = !person.name ? 'error-cell' : '';
        const birthOrderClass = (!person.birthOrder || (person.birthOrder != 2 && person.birthOrder != 3)) ? 'error-cell' : '';
        const idNumberClass = (!person.idNumber || person.idNumber.length < 18) ? 'error-cell' : '';
        const parentNameClass = !person.parentName ? 'error-cell' : '';
        const productTypeClass = (!person.productType || !['全日托', '半日托', '临时托', '计时托'].includes(person.productType)) ? 'error-cell' : '';
        const classNameClass = (!person.className || !['托大班', '托小班', '乳儿班'].includes(person.className)) ? 'error-cell' : '';
        const entryDateClass = !person.entryDate ? 'error-cell' : '';
        const paymentDateClass = !person.paymentDate ? 'error-cell' : '';
        const paymentAmountClass = (!person.paymentAmount && person.paymentAmount !== 0) ? 'error-cell' : '';
        const paymentMonthsClass = (!person.paymentMonths && person.paymentMonths !== 0) ? 'error-cell' : '';
        const monthlyFeeClass = (!person.monthlyFee && person.monthlyFee !== 0) ? 'error-cell' : '';
        const attendanceDaysClass = (!person.attendanceDays && person.attendanceDays !== 0) ? 'error-cell' : '';
        
        // 构建表格行HTML
        row.innerHTML = `
            <td>${index + 1}</td>   
            <td class="compact-cell ${nameClass}">${person.name}</td>
            <td class="compact-cell ${birthOrderClass}">${person.birthOrder}</td>
            <td class="compact-cell col-id ${idNumberClass}">${person.idNumber || ''}</td>
            <td class="compact-cell ${parentNameClass}">${person.parentName}</td>
            <td class="compact-cell ${productTypeClass}">${person.productType}</td>
            <td class="compact-cell ${classNameClass}">${person.className}</td>
            <td class="compact-cell ${entryDateClass}">${person.entryDate}</td>
            <td class="compact-cell ${paymentDateClass}">${person.paymentDate}</td>
            <td class="compact-cell ${paymentAmountClass}">${person.paymentAmount}</td>
            <td class="compact-cell ${paymentMonthsClass}">${person.paymentMonths}</td>
            <td class="compact-cell ${monthlyFeeClass}">${person.monthlyFee ? person.monthlyFee.toFixed(0) : ''}</td>
            <td class="compact-cell ${attendanceDaysClass}">${person.attendanceDays || ''}</td>
            <td class="compact-cell">
                <span class="status-${result.status}" title="${allMessages}">
                    ${allMessages.substring(0, 25)}${allMessages.length > 25 ? '...' : ''}
                </span>
            </td>
            <td class="compact-cell" style="text-align:center;">
                <button class="delete-btn" onclick="deleteRow(this)">删除</button>
            </td>
        `;
        
        tbody.appendChild(row);
        
        // 为错误单元格添加提示
        addCellTooltips(row, person);
    });
}

/**
 * 为错误单元格添加提示信息
 * @param {HTMLElement} row - 表格行元素
 * @param {Object} person - 人员数据
 */
function addCellTooltips(row, person) {
    const cells = row.querySelectorAll('.error-cell');
    cells.forEach(cell => {
        const cellIndex = Array.from(cell.parentNode.cells).indexOf(cell);
        let errorMessage = '';
        
        // 根据单元格索引设置对应的错误提示
        switch(cellIndex) {
            case 1: errorMessage = '婴幼儿姓名不能为空'; break;
            case 2: 
                if (!person.birthOrder) {
                    errorMessage = '孩次不能为空';
                } else if (person.birthOrder != 2 && person.birthOrder != 3) {
                    errorMessage = '孩次只能填写2或3';
                }
                break;
            case 3: 
                if (!person.idNumber) {
                    errorMessage = '身份证号码不能为空';
                } else if (person.idNumber.length < 18) {
                    errorMessage = `身份证号码长度不能少于18位，当前为${person.idNumber.length}位`;
                }
                break;
            case 4: errorMessage = '家长姓名不能为空'; break;
            case 5: 
                if (!person.productType) {
                    errorMessage = '托育产品不能为空';
                } else if (!['全日托', '半日托', '临时托', '计时托'].includes(person.productType)) {
                    errorMessage = '托育产品只能是：全日托、半日托、临时托、计时托';
                }
                break;
            case 6: 
                if (!person.className) {
                    errorMessage = '班级不能为空';
                } else if (!['托大班', '托小班', '乳儿班'].includes(person.className)) {
                    errorMessage = '班级只能是：托大班、托小班、乳儿班';
                }
                break;
            case 7: errorMessage = '入托时间不能为空'; break;
            case 8: errorMessage = '本次缴费时间不能为空'; break;
            case 9: errorMessage = '本次缴费不能为空'; break;
            case 10: errorMessage = '费用时长不能为空'; break;
            case 11: errorMessage = '单月费用不能为空'; break;
            case 12: errorMessage = '出勤天数不能为空'; break;
        }
        
        if (errorMessage) {
            cell.title = errorMessage;
        }
    });
}

/**
 * 删除表格行
 * @param {HTMLElement} btn - 删除按钮元素
 */
function deleteRow(btn) {
    // 获取当前行
    const row = btn.closest('tr');
    
    // 确认删除
    if (!confirm('确定要删除这一行数据吗？')) {
        return;
    }
    
    // 获取tbody（确保在正确的容器中计算索引）
    const tbody = document.getElementById('preview-body-monthly');
    
    // 计算行索引（只计算tbody中的行，从0开始）
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const rowIndex = rows.indexOf(row);
    
    if (rowIndex !== -1) {
        // 从数据中删除对应行
        excelData.splice(rowIndex, 1);
        validationResults.splice(rowIndex, 1);
        
        // 重新渲染预览
        renderPreview();
        
        // 更新按钮状态
        updateButtons();
        
        // 更新验证摘要
        updateValidationSummary();
        
        console.log(`成功删除了第 ${rowIndex + 1} 行数据`);
    } else {
        console.error('无法找到对应的行索引');
    }
}

/**
 * 更新验证摘要（删除后重新计算）
 */
function updateValidationSummary() {
    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    // 重新统计验证结果
    validationResults.forEach(result => {
        if (result.status === 'error') errorCount++;
        else if (result.status === 'warning') warningCount++;
        else successCount++;
    });

    updateValidationSummaryMonthly(successCount, warningCount, errorCount);
}

// ==================== 数据导入函数 ====================

/**
 * 导入月度数据
 */
async function importMonthlyData() {
    try {
        const selectedKindergarten = document.getElementById('kindergarten-select-monthly').value;
        // 获取选择的托育机构名称
        let selectedKindergartenName = document.getElementById("kindergarten-select-monthly").options[
            document.getElementById("kindergarten-select-monthly").selectedIndex
        ].text;
        // 获取年份和月份
        let year = document.getElementById("year-select").value;
        let month = document.getElementById("month-select").value;
        // 拼成 "YYYY-MM" 格式
        let selectedYearMonth = year + "-" + month.padStart(2, "0");
        
        // 发送导入请求
        const response = await fetch('importMonthlyData.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(excelData.map(p => ({ 
                ...p, 
                year: selectedYear, 
                month: selectedMonth, 
                kindergartenId: selectedKindergarten, 
                kindergartenName: selectedKindergartenName, 
                yearMonth: selectedYearMonth 
            })))
        });
        const data = await response.json();
        console.log(data);

        // 清空消息
        document.getElementById('success-message-monthly').innerHTML = '';
        document.getElementById('error-message-monthly').innerHTML = '';

        // 计算统计信息
        const successCount = data.successCount || 0;
        const failedCount = data.errors ? data.errors.length : 0;
        const totalCount = successCount + failedCount;

        if (successCount > 0) {
            let successMessage = `
                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 18px; margin-right: 8px;">✅</span>
                        <span style="font-weight: bold; color: #155724; font-size: 16px;">导入完成</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${successCount}</div>
                            <div style="font-size: 12px; color: #666;">成功</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${failedCount}</div>
                            <div style="font-size: 12px; color: #666;">失败</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #007bff;">${totalCount}</div>
                            <div style="font-size: 12px; color: #666;">总计</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; text-align: center; padding: 8px; background: white; border-radius: 4px;">
                        <span style="font-weight: bold; color: #333;">成功率: </span>
                        <span style="font-weight: bold; color: #28a745;">${Math.round((successCount / totalCount) * 100)}%</span>
                    </div>
                </div>
            `;
            
            document.getElementById('success-message-monthly').innerHTML = successMessage;
            document.getElementById('success-message-monthly').style.display = 'block';
            
            // 只有全部成功导入才自动打印
            if (failedCount === 0 && data.importedData && data.importedData.length > 0) {
                printImportedData(data.importedData);
                // 全部导入成功后清空数据
                clearMonthlyPreview();
            }
        }

        if (data.errors && data.errors.length > 0) {
            let errorHtml = `
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 16px;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 18px; margin-right: 8px;">❌</span>
                        <span style="font-weight: bold; color: #721c24; font-size: 16px;">导入失败详情 (${failedCount} 条)</span>
                    </div>
                    <div style="max-height: 200px; overflow-y: auto;">
            `;
            
            data.errors.forEach((err, index) => {
                errorHtml += `
                    <div style="display: flex; align-items: flex-start; margin-bottom: 8px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #dc3545;">
                        <span style="background: #dc3545; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">${index + 1}</span>
                        <span style="color: #721c24; line-height: 1.4;">${err}</span>
                    </div>
                `;
            });
            
            errorHtml += `
                    </div>
                </div>
            `;
            
            document.getElementById('error-message-monthly').innerHTML = errorHtml;
            document.getElementById('error-message-monthly').style.display = 'block';
        }
        
        // 如果没有成功导入任何数据
        if (successCount === 0 && failedCount === 0) {
            showMessage('error-message-monthly', '❌ 导入失败：未成功导入任何数据');
        }
        
    } catch (err) {
        showMessage('error-message-monthly', '❌ 导入失败: ' + err.message);
    }
}

// ==================== 工具函数 ====================

/**
 * 更新按钮状态
 */
function updateButtons() {
    const hasData = excelData.length > 0;
    const hasErrors = validationResults.some(r => r.status === 'error');
    document.getElementById('validate-btn-monthly').disabled = !hasData;
    document.getElementById('import-btn-monthly').disabled = !hasData || hasErrors;
}

/**
 * 显示状态条
 * @param {string} text - 状态文本
 * @param {number} progress - 进度百分比
 */
function showStatus(text, progress) {
    const statusBar = document.getElementById('status-bar-monthly');
    const statusText = document.getElementById('status-text-monthly');
    const progressBar = document.getElementById('progress-bar-monthly');
    statusBar.style.display = 'block';
    statusText.textContent = text;
    progressBar.style.width = progress + '%';
}

/**
 * 隐藏状态条
 */
function hideStatus() { 
    document.getElementById('status-bar-monthly').style.display = 'none'; 
}

/**
 * 显示消息
 * @param {string} elementId - 消息元素ID
 * @param {string} message - 消息内容
 */
function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
}

/**
 * 更新验证结果摘要
 * @param {number} success - 成功条数
 * @param {number} warning - 警告条数
 * @param {number} error - 错误条数
 */
function updateValidationSummaryMonthly(success, warning, error) {
    const summary = document.getElementById('validation-summary-monthly');
    if (!summary) return;

    summary.style.display = 'block';

    const totalCountEl = document.getElementById('total-count-monthly');
    const successEl = document.getElementById('success-count-monthly');
    const warningEl = document.getElementById('warning-count-monthly');
    const errorEl = document.getElementById('error-count-monthly');

    const total = excelData.length;

    if (totalCountEl) totalCountEl.textContent = total;
    if (successEl) {
        successEl.textContent = success;
        successEl.style.color = '#28a745';
    }
    if (warningEl) {
        warningEl.textContent = warning;
        warningEl.style.color = '#ffc107';
    }
    if (errorEl) {
        errorEl.textContent = error;
        errorEl.style.color = '#f44336';
    }
}

// ==================== 打印功能函数 ====================

/**
 * 打印导入的数据
 * @param {Array} rows - 要打印的数据行
 */
function printImportedData(rows) {
    // 统计信息
    const totalCount = rows.length;
    const secondChildCount = rows.filter(row => row.birthOrder == 2).length;
    const thirdChildCount = rows.filter(row => row.birthOrder == 3).length;
    
    // 获取幼儿园名称
    const kindergartenName = getKindergartenName();
    
    // 获取月份
    let dataMonth = document.getElementById("month-select").value;
    
    // 构建表格HTML
    let html = `
    <table border="1" style="border-collapse: collapse; width: 100%; margin-top: 10px;">
        <thead>
            <tr>
                <th colspan="13" style="text-align: center; font-size: 16px; padding: 12px; background-color: #e3f2fd;">
                    ${kindergartenName}（托育机构）二孩_${secondChildCount}_人，三孩_${thirdChildCount}_人，共计_${totalCount}_人（${dataMonth}月份）
                </th>
            </tr>
            <tr>
                <th>序号</th>
                <th>婴幼儿姓名</th>
                <th>孩次</th>
                <th>身份证号码</th>
                <th>家长姓名</th>
                <th>托育产品</th>
                <th>班级</th>
                <th>入托时间</th>
                <th>本次缴费时间</th>
                <th>本次缴费</th>
                <th>费用时长(月)</th>
                <th>单月费用</th>
                <th>出勤天数</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    // 添加数据行
    rows.forEach((row, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${row.name || ''}</td>
                <td>${row.birthOrder || ''}</td>
                <td>${row.idNumber || ''}</td>
                <td>${row.parentName || ''}</td>
                <td>${row.productType || ''}</td>
                <td>${row.className || ''}</td>
                <td>${formatDate(row.entryDate) || ''}</td>
                <td>${formatDate(row.paymentDate) || ''}</td>
                <td>${formatCurrency(row.paymentAmount)}</td>
                <td>${row.paymentMonths || ''}</td>
                <td>${formatCurrency(row.monthlyFee)}</td>
                <td>${row.attendanceDays || ''}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    
    // 打开打印窗口
    const printWindow = window.open('', '', 'width=1000,height=600');
    const printContent = generatePrintDocument(kindergartenName, dataMonth, html);
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

/**
 * 获取幼儿园名称
 * @returns {string} 幼儿园名称
 */
function getKindergartenName() {
    let selectedKindergartenName = document.getElementById("kindergarten-select-monthly").options[
        document.getElementById("kindergarten-select-monthly").selectedIndex
    ].text;
    return selectedKindergartenName;
}

/**
 * 生成打印文档
 * @param {string} kindergartenName - 幼儿园名称
 * @param {string} dataMonth - 数据月份
 * @param {string} html - 表格HTML
 * @returns {string} 完整的打印文档HTML
 */
function generatePrintDocument(kindergartenName, dataMonth, html) {
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(kindergartenName)}普惠补贴人员信息 - ${dataMonth}月份</title>
        <style>
            body { 
                font-family: "Microsoft YaHei", Arial, sans-serif; 
                margin: 20px; 
                line-height: 1.4;
            }
            table { 
                font-size: 12px; 
                border: 2px solid #333; 
                border-collapse: collapse;
                width: 100%;
                margin: 0 auto;
            }
            th, td { 
                padding: 6px 8px; 
                text-align: center; 
                border: 1px solid #ddd; 
            }
            th { 
                background-color: #f5f5f5; 
                font-weight: bold; 
            }
            .print-header {
                text-align: center;
                margin-bottom: 20px;
            }
            .print-footer {
                margin-top: 20px;
                text-align: right;
                font-size: 12px;
                color: #666;
            }
        </style>
    </head>
    <body>
        ${html}
        <div class="print-footer">
            生成时间：${new Date().toLocaleString('zh-CN')}
        </div>
    </body>
    </html>`;
}

/**
 * HTML转义函数
 * @param {string} unsafe - 未转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 格式化日期
 * @param {string} dateString - 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return isNaN(date) ? dateString : date.toLocaleDateString('zh-CN');
    } catch (e) {
        return dateString;
    }
}

/**
 * 格式化货币金额
 * @param {number} amount - 金额
 * @returns {string} 格式化后的金额
 */
function formatCurrency(amount) {
    if (!amount && amount !== 0) return '';
    return typeof amount === 'number' ? amount.toFixed(0) : amount;
}

/**
 * 导出到Excel
 * @param {Array} rows - 要导出的数据行
 */
function exportToXLS(rows) {
    let table = '<table border="1"><tr><th>序号</th><th>孩子姓名</th>...';
    rows.forEach((row, i) => {
        table += `<tr><td>${i+1}</td><td>${row.name}</td>...</tr>`;
    });
    table += '</table>';

    const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '导入数据.xls';
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * 清空月度预览数据及相关界面元素
 */
function clearMonthlyPreview() {
    // 1. 清空数据数组
    excelData = [];
    
    // 2. 清空验证结果
    validationResults = [];
    
    // 3. 清空预览表格内容
    const tbody = document.getElementById('preview-body-monthly');
    if (tbody) {
        tbody.innerHTML = '';
        
        // 显示空状态提示
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="15" style="text-align:center; color:#999; padding:20px;">
                暂无数据，请先导入Excel文件
            </td>
        `;
        tbody.appendChild(emptyRow);
    }
    
    // // 4. 隐藏预览区域（可选）
    // const previewSection = document.getElementById('preview-section-monthly');
    // if (previewSection) {
    //     previewSection.style.display = 'none';
    // }
    
    // 5. 清空文件输入框
    const fileInput = document.getElementById('file-input-monthly');
    if (fileInput) {
        fileInput.value = '';
    }
    
    // 6. 隐藏文件信息显示
    const fileInfo = document.getElementById('file-info-monthly');
    if (fileInfo) {
        fileInfo.style.display = 'none';
    }
    
    // 7. 清空文件名显示
    const fileName = document.getElementById('file-name-monthly');
    if (fileName) {
        fileName.textContent = '';
    }
    
    // 8. 隐藏验证摘要
    const validationSummary = document.getElementById('validation-summary-monthly');
    if (validationSummary) {
        validationSummary.style.display = 'none';
    }
    // 9. 隐藏成功和错误消息
    const successMessage = document.getElementById('success-message-monthly');
    const errorMessage = document.getElementById('error-message-monthly');
    if (successMessage) {
        successMessage.style.display = 'none';
        successMessage.innerHTML = '';
    }
    if (errorMessage) {
        errorMessage.style.display = 'none';
        errorMessage.innerHTML = '';
    }
    // 10. 更新按钮状态
    updateButtons();
    
    // 11. 重新加载幼儿园列表（如果需要）
    // loadKindergartens();
    
    console.log('月度预览数据已清空');
}
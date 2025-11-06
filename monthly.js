let excelData = [];
let selectedYear = 2025;
let selectedMonth = 4;
let validationResults = [];

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    loadKindergartens();
    initDragAndDrop();
    setupEventListeners();
    updateSelectedDate();
    document.getElementById('preview-section-monthly').style.display = 'block';
});

async function loadKindergartens() {
    try {
        const response = await fetch('http://localhost/kindergarten/getKindergartens.php');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('kindergarten-select-monthly');
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

function setupEventListeners() {
    document.getElementById('year-select').addEventListener('change', async function(e) {
        selectedYear = parseInt(e.target.value);
        updateSelectedDate();
        if (excelData.length > 0) await validateData();
    });
    
    document.getElementById('month-select').addEventListener('change', async function(e) {
        selectedMonth = parseInt(e.target.value);
        updateSelectedDate();
        if (excelData.length > 0) await validateData();
    });
    
    document.getElementById('file-input-monthly').addEventListener('change', function(e) {
        handleFileSelect(e.target.files);
    });
}

function updateSelectedDate() {
    document.getElementById('selected-date').textContent = `${selectedYear}年${selectedMonth}月`;
}

function initDragAndDrop() {
    const dropArea = document.getElementById('drop-area-monthly');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => dropArea.addEventListener(eventName, highlight, false));
    ['dragleave', 'drop'].forEach(eventName => dropArea.addEventListener(eventName, unhighlight, false));
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

function handleFileSelect(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
        showMessage('error-message-monthly', '请选择Excel文件（.xls 或 .xlsx）');
        return;
    }
    
    document.getElementById('file-info-monthly').style.display = 'block';
    document.getElementById('file-name-monthly').textContent = file.name;
    showStatus('正在读取Excel文件...', 30);

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
function parseExcelDate(value) {
    if (!value) return '';

    let str = value.toString().trim();

    // 去掉 + 前缀
    if (str.startsWith('+')) str = str.slice(1);

    // 纯数字
    if (/^\d+$/.test(str)) {
        const num = Number(str);

        // Excel 序列日期通常在 1900 年之后，值大于 30
        if (num > 30 && num < 2958465) { 
            return excelSerialToYMD(num);
        }

        // 如果是可能的 UNIX 时间戳（秒级或毫秒级）
        if (num > 1000000000 && num < 10000000000000) { // 秒级或毫秒级
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

// Excel 序列日期转 YYYYMMDD
function excelSerialToYMD(serial) {
    const excelEpoch = new Date(1899, 11, 30); // Excel起始日期
    const days = Math.floor(serial);
    const milliseconds = (serial - days) * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + milliseconds);
    return formatDateYMD(date);
}

// 格式化 Date -> YYYYMMDD
function formatDateYMD(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

function processExcelData(data) {
    excelData = [];
    validationResults = [];
    for (let i = 2; i < data.length; i++) {
        const row = data[i];
        if (row && row.length >= 12 && row[1]) {
            const person = {
                name: row[1] || '',
                birthOrder: row[2] || '',
                idNumber: String(row[3] || '').trim(),
                parentName: row[4] || '',
                productType: row[5] || '',
                className: row[6] || '',
                entryDate: parseExcelDate(row[7]),
                paymentDate: parseExcelDate(row[8]),
                paymentAmount: parseFloat(row[9] || 0),
                paymentMonths: parseInt(row[10] || 0),
                monthlyFee: parseFloat(row[11] || 0),
                attendanceDays: parseInt(row[12] || 0)
            };
            excelData.push(person);
        }
    }
    
    document.getElementById('preview-section-monthly').style.display = 'block';
    document.getElementById('validate-btn-monthly').disabled = false;
    updateButtons();
    validateData();
}

function formatExcelDate(dateValue) {
    if (!dateValue) return '';

    // 如果是数字，直接按Excel日期处理
    if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        return date.toISOString().split('T')[0].replace(/-/g, '');
    }

    // 如果是字符串，先去掉 "+"，再转成数字
    if (typeof dateValue === 'string') {
        const num = Number(dateValue.replace(/\+/g, ''));
        if (!isNaN(num)) {
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
            return date.toISOString().split('T')[0].replace(/-/g, '');
        }
        // 如果不是数字，就去掉非数字字符返回
        return dateValue.replace(/\D/g, '');
    }

    return '';
}

async function validateData() {
    if (excelData.length === 0) return;

    showStatus('正在验证数据...', 30);
    validationResults = [];

    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    const workdaysInMonth = calculateWorkdays(selectedYear, selectedMonth);
    const halfWorkdays = Math.floor(workdaysInMonth / 2);

    for (let index = 0; index < excelData.length; index++) {
        const person = excelData[index];
        const result = { index, errors: [], warnings: [], status: 'success' };

        // 数据库检查（区分全库和幼儿园匹配）
        const dbCheck = await checkChildInDatabase(person.name, person.idNumber);
        if (!dbCheck.ok) {
            result.errors.push(dbCheck.message);
        } 
        // 检查孩次
        else if (!await checkBirthOrderConsistency(person.name, person.idNumber, person.birthOrder)) {
                    result.errors.push(`孩次与信息库中不符`);
                 }
    
        // 年龄检查
        const ageCheck = checkAgeLimit(person.idNumber, selectedYear, selectedMonth);
        if (ageCheck === 'exceeded') result.errors.push(`已超过3周岁`);
        else if (ageCheck === 'reaching') result.warnings.push(`将在本月超过3周岁`);

        // 费用检查
        if (!checkFeeStandard(person.className, person.monthlyFee)) {
            const standard = getFeeStandard(person.className);
            result.errors.push(`收费超标，不应超（标准: ${standard}元）`);
        }
        if (person.paymentAmount > 0 && person.paymentMonths > 0) {
            const calculatedFee = person.paymentAmount / person.paymentMonths;
            if (Math.abs(calculatedFee - person.monthlyFee) > 1) {
                result.errors.push(`费用计算错误`);
            }
        }

        // 出勤天数检查
        if (person.attendanceDays > 0 && person.attendanceDays < halfWorkdays) {
            result.errors.push(`出勤不足（需${halfWorkdays}天）`);
        }

        // 状态统计
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

    renderPreview();
    updateValidationSummaryMonthly(successCount, warningCount, errorCount);
    showStatus('验证完成', 100);
    setTimeout(() => hideStatus(), 1000);
    updateButtons();
}



// 后端比对
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


function getFeeStandard(className) {
    const standards = { '托大班': 1400, '托小班': 1700, '乳儿班': 2100 };
    for (const [key, fee] of Object.entries(standards)) if (className.includes(key)) return fee;
    return 0;
}

function checkFeeStandard(className, monthlyFee) {
    const standard = getFeeStandard(className);
    return standard === 0 || monthlyFee <= standard;
}

let holidayData = [];

// 1️⃣ 加载 JSON 文件（假设文件名是 holidays2025.json）
async function loadHolidayData() {
    const res = await fetch('holidays2025.json');
    holidayData = await res.json();
}

// 2️⃣ 判断某一天是否是工作日
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

// 3️⃣ 计算指定年月工作日数量
function calculateWorkdays(year, month) {
    let count = 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, month - 1, d);
        if (isWorkday(dt)) count++;
    }
    return count;
}

function renderPreview() {
    const tbody = document.getElementById('preview-body-monthly');
    tbody.innerHTML = '';
    excelData.forEach((person, index) => {
        const result = validationResults[index];
        const row = document.createElement('tr');
        if (result.status === 'error') row.classList.add('error-row');
        else if (result.status === 'warning') row.classList.add('warning-row');
        else row.classList.add('success-row');
        const allMessages = [...result.errors, ...result.warnings].join('；');
        row.innerHTML = `
            <td class="compact-cell">${person.name}</td>
            <td class="compact-cell">${person.birthOrder}</td>
            <td class="compact-cell col-id">${person.idNumber || ''}</td>
            <td class="compact-cell">${person.parentName}</td>
            <td class="compact-cell">${person.productType}</td>
            <td class="compact-cell">${person.className}</td>
            <td class="compact-cell">${person.entryDate}</td>
            <td class="compact-cell">${person.paymentDate}</td>
            <td class="compact-cell">${person.paymentAmount}</td>
            <td class="compact-cell">${person.paymentMonths}</td>
            <td class="compact-cell">${person.monthlyFee ? person.monthlyFee.toFixed(0) : ''}</td>
            <td class="compact-cell">${person.attendanceDays || ''}</td>
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

    });
}
function deleteRow(btn) {
    const row = btn.closest('tr');
    row.remove();
}


/**
 * 安全更新验证结果摘要（针对月度统计）
 * @param {number} success 成功条数
 * @param {number} warning 警告条数
 * @param {number} error 错误条数
 */
function updateValidationSummaryMonthly(success, warning, error) {
    const summary = document.getElementById('validation-summary-monthly');
    if (!summary) return;

    summary.style.display = 'block';

    const totalCountEl = document.getElementById('total-count-monthly');
    const successEl = document.getElementById('success-count-monthly');
    const warningEl = document.getElementById('warning-count-monthly');
    const errorEl = document.getElementById('error-count-monthly');

    const total = (typeof excelData !== 'undefined' && Array.isArray(excelData)) ? excelData.length : 0;

    if (totalCountEl) totalCountEl.textContent = total;
    if (successEl) {
        successEl.textContent = success;
        successEl.style.color = '#28a745'; // 绿色
    }
    if (warningEl) {
        warningEl.textContent = warning;
        warningEl.style.color = '#ffc107'; // 黄色
    }
    if (errorEl) {
        errorEl.textContent = error;
        errorEl.style.color = '#f44336'; // 红色
    }
}

async function importMonthlyData() {
    try {
        
        const selectedKindergarten = document.getElementById('kindergarten-select-monthly').value;
        // 获取选择的托育机构名称
        let selectedKindergartenName = document.getElementById("kindergarten-select-monthly").options[
            document.getElementById("kindergarten-select-monthly").selectedIndex
        ].text;
        // 取年份
        let year = document.getElementById("year-select").value;
        // 取月份
        let month = document.getElementById("month-select").value;
        // 拼成 "YYYY-MM" 格式（不足两位的月份补 0）
        let selectedYearMonth = year + "-" + month.padStart(2, "0");
        const response = await fetch('importMonthlyData.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(excelData.map(p => ({ ...p, year: selectedYear, month: selectedMonth, kindergartenId: selectedKindergarten, kindergartenName: selectedKindergartenName, yearMonth: selectedYearMonth})))
        });
        const data = await response.json();
        console.log(data);

         // 清空消息
        document.getElementById('success-message-monthly').innerHTML = '';
        document.getElementById('error-message-monthly').innerHTML = '';

        if (data.successCount > 0) {
            showMessage('success-message-monthly', `成功导入 ${data.successCount} 条`);
            
            // 自动打印导入的内容
            if (data.importedData && data.importedData.length > 0) {
                printImportedData(data.importedData);
            }
        }

        if (data.errors && data.errors.length > 0) {
            // 循环显示每条错误
            let errorHtml = '<ul>';
            data.errors.forEach(err => {
                errorHtml += `<li>${err}</li>`;
            });
            errorHtml += '</ul>';
            document.getElementById('error-message-monthly').innerHTML = errorHtml;
        }
    } catch (err) {
        showMessage('error-message-monthly', '导入失败: ' + err.message);
    }
}

function updateButtons() {
    const hasData = excelData.length > 0;
    const hasErrors = validationResults.some(r => r.status === 'error');
    document.getElementById('validate-btn-monthly').disabled = !hasData;
    document.getElementById('import-btn-monthly').disabled = !hasData || hasErrors;
}

function showStatus(text, progress) {
    const statusBar = document.getElementById('status-bar-monthly');
    const statusText = document.getElementById('status-text-monthly');
    const progressBar = document.getElementById('progress-bar-monthly');
    statusBar.style.display = 'block';
    statusText.textContent = text;
    progressBar.style.width = progress + '%';
}

function hideStatus() { document.getElementById('status-bar-monthly').style.display = 'none'; }

function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
}

function printImportedData(rows) {
    let html = `
    <table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
            <tr>
                <th>序号</th>
                <th>孩子姓名</th>
                <th>孩次</th>
                <th>身份证号</th>
                <th>托育机构</th>
                <th>父亲姓名</th>
                <th>母亲姓名</th>
                <th>录入时间</th>
                <th>状态</th>
            </tr>
        </thead>
        <tbody>
    `;

    rows.forEach((row, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${row.name || ''}</td>
                <td>${row.birthOrder || ''}</td>
                <td>${row.idNumber || ''}</td>
                <td>${row.kindergartenName || ''}</td>
                <td>${row.fatherName || ''}</td>
                <td>${row.motherName || ''}</td>
                <td>${row.entryDate || ''}</td>
                <td>${row.status || ''}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';

    const printWindow = window.open('', '', 'width=1000,height=600');
    printWindow.document.write('<html><head><title>导入内容</title></head><body>');
    printWindow.document.write(html);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

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

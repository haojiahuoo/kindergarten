// stats.js - 统计页面功能
let currentPage = 1;
let pageSize = 10;
let totalRecords = 0;
let currentData = [];

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载幼儿园数据
    loadStatsKindergarten();
    initStatsPage();
    // 页面加载完成后立即加载数据
    loadStatsData();
});

async function loadStatsKindergarten() {
    try {
        const response = await fetch('http://localhost/kindergarten/getKindergartens.php');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('stats-kindergarten-select');
            select.innerHTML = ''; // 清空旧数据

            // 添加默认项
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- 全部托育机构 --';
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

function initStatsPage() {
    // 不设置默认日期，让时间条件为空
    // setDefaultDateRange(); // 注释掉这行
    
    // 绑定分页事件
    document.getElementById('page-size').addEventListener('change', function(e) {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        loadStatsData();
    });
    
    document.getElementById('prev-page').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            loadStatsData();
        }
    });
    
    document.getElementById('next-page').addEventListener('click', function() {
        if (currentPage < Math.ceil(totalRecords / pageSize)) {
            currentPage++;
            loadStatsData();
        }
    });
    
    // 绑定输入框回车事件
    document.getElementById('keyword-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchData();
        }
    });
    
    // 绑定筛选条件变化事件（实时更新）
    document.getElementById('stats-kindergarten-select').addEventListener('change', function() {
        currentPage = 1;
        loadStatsData();
    });
    
    document.getElementById('stats-birth-order').addEventListener('change', function() {
        currentPage = 1;
        loadStatsData();
    });
    
    document.getElementById('start-date').addEventListener('change', function() {
        currentPage = 1;
        loadStatsData();
    });
    
    document.getElementById('end-date').addEventListener('change', function() {
        currentPage = 1;
        loadStatsData();
    });

    // 绑定季度选择事件
    document.getElementById('quarter-select').addEventListener('change', function() {
        currentPage = 1;
        // 当选择季度时，禁用时间范围输入框
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        
        if (this.value) {
            startDateInput.disabled = true;
            endDateInput.disabled = true;
            // 清空时间范围的值
            startDateInput.value = '';
            endDateInput.value = '';
        } else {
            startDateInput.disabled = false;
            endDateInput.disabled = false;
        }
        loadStatsData();
    });
}

// 查询数据
function searchData() {
    currentPage = 1;
    loadStatsData();
}

// 加载统计数据
function loadStatsData() {
    const kindergartenSelect = document.getElementById('stats-kindergarten-select');
    const kindergartenId = kindergartenSelect.value; // 直接使用ID
    
    // 特殊处理默认选项和新建选项
    let kindergartenValue = '';
    if (kindergartenId && kindergartenId !== 'new') {
        kindergartenValue = kindergartenId; // 传递ID而不是名称
    }
    
    const birthOrder = document.getElementById('stats-birth-order').value;
    const quarter = document.getElementById('quarter-select').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const keyword = document.getElementById('keyword-search').value;
    
    showLoading();
    
    // 构建请求参数
    const requestData = {
        kindergarten: kindergartenValue,
        birthOrder: birthOrder,
        quarter: quarter,
        keyword: keyword,
        page: currentPage,
        pageSize: pageSize
    };
    
    // 只有在用户选择了时间且季度未选择时才添加时间条件
    if (startDate && !quarter) {
        requestData.startDate = startDate;
    }
    if (endDate && !quarter) {
        requestData.endDate = endDate;
    }
    
    console.log('发送统计请求:', requestData);
    
    // 发送API请求
    fetch('http://localhost/kindergarten/stats.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('收到统计响应:', data);
        
        if (data.success) {
            currentData = data.records || [];
            totalRecords = data.totalRecords || 0;
            
            renderStatsTable();
            updatePagination();
            updateStatsSummary(data.summary || {});
        } else {
            throw new Error(data.message || '数据加载失败');
        }
    })
    .catch(error => {
        console.error('加载数据失败:', error);
        showError('加载数据失败: ' + error.message);
    })
    .finally(() => {
        hideLoading();
    });
}

// 渲染统计表格
function renderStatsTable() {
    const tbody = document.getElementById('stats-body');
    
    if (!currentData || currentData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999">暂无数据</td></tr>';
        return;
    }
    
    let html = '';
    currentData.forEach((record, index) => {
        const rowNumber = (currentPage - 1) * pageSize + index + 1;
        
        html += `
            <tr>
                <td>${rowNumber}</td>
                <td>${escapeHtml(record.childName || '')}</td>
                <td>${getBirthOrderText(record.birthOrder)}</td>
                <td>${formatIdNumber(record.childId || '')}</td>
                <td>${escapeHtml(record.kindergarten || '')}</td>
                <td>${escapeHtml(record.fatherName || '')}</td>
                <td>${formatDate(record.createTime)}</td>
                <td>${formatCurrency(record.subsidyAmount || 0)}</td>
                <td>${getStatusBadge(record.status || 'active')}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// 更新统计摘要信息
function updateStatsSummary(summary) {
    // 机构数量
    document.getElementById('kindergarten-count').textContent = (summary.kindergartenCount || 0).toLocaleString();
    
    // 建档人数
    document.getElementById('total-count').textContent = (summary.totalCount || 0).toLocaleString();
    document.getElementById('second-child-count').textContent = (summary.secondChildCount || 0).toLocaleString();
    document.getElementById('third-child-count').textContent = (summary.thirdChildCount || 0).toLocaleString();
    
    // 至今三岁以下
    document.getElementById('under-three-total').textContent = (summary.underThreeTotal || 0).toLocaleString();
    document.getElementById('under-three-second').textContent = (summary.underThreeSecond || 0).toLocaleString();
    document.getElementById('under-three-third').textContent = (summary.underThreeThird || 0).toLocaleString();
    
    // 申领补贴人数  
    document.getElementById('total-apply-count').textContent = (summary.totalApplyCount || 0).toLocaleString();
    document.getElementById('second-child-apply-count').textContent = (summary.secondChildApplyCount || 0).toLocaleString();
    document.getElementById('third-child-apply-count').textContent = (summary.thirdChildApplyCount || 0).toLocaleString();
    
    // 申请金额
    document.getElementById('total-subsidy-amount').textContent = formatCurrency(summary.totalSubsidy || 0);
    document.getElementById('second-child-subsidy').textContent = formatCurrency(summary.secondChildSubsidy || 0);
    document.getElementById('third-child-subsidy').textContent = formatCurrency(summary.thirdChildSubsidy || 0);
}

// 货币格式化函数
function formatCurrency(amount) {
    return '¥' + (amount || 0).toLocaleString('zh-CN');
}

// 在 resetFilters 函数中重置季度选择
function resetFilters() {
    document.getElementById('stats-kindergarten-select').value = '';
    document.getElementById('stats-birth-order').value = '';
    document.getElementById('quarter-select').value = '';
    document.getElementById('keyword-search').value = '';
    
    // 清空时间条件并重新启用输入框
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('start-date').disabled = false;
    document.getElementById('end-date').disabled = false;
    
    currentPage = 1;
    loadStatsData();
}

// 导出数据
function exportStatsData() {
    if (!currentData || currentData.length === 0) {
        alert('没有数据可导出');
        return;
    }
    
    // 这里可以添加导出逻辑
    alert('导出功能开发中...');
    console.log('导出数据:', currentData);
}

// 辅助函数
function getBirthOrderText(birthOrder) {
    const orderMap = {
        2: '2',
        3: '3'
    };
    return orderMap[birthOrder] || `第${birthOrder}孩`;
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return '';
    
    if (typeof dateString === 'string') {
        if (/^\d{8}$/.test(dateString)) {
            const year = dateString.substring(0, 4);
            const month = dateString.substring(4, 6);
            const day = dateString.substring(6, 8);
            return `${year}-${month}-${day}`;
        }
        
        if (dateString.includes('T') || dateString.includes(' ')) {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        return dateString;
    }
    
    if (dateString instanceof Date && !isNaN(dateString.getTime())) {
        const year = dateString.getFullYear();
        const month = String(dateString.getMonth() + 1).padStart(2, '0');
        const day = String(dateString.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    return String(dateString || '');
}

// function formatIdNumber(id) {
//     if (!id || id.length !== 18) return id || '';
//     return id.substring(0, 6) + '****' + id.substring(14);
// }
function formatIdNumber(id) {
    return id || '';
}

function getStatusBadge(status) {
    const statusMap = {
        'active': '<span style="color: #28a745; font-weight: bold;">正常</span>',
        'inactive': '<span style="color: #ffc107; font-weight: bold;">停用</span>',
        'pending': '<span style="color: #ffc107; font-weight: bold;">待审核</span>',
        'approved': '<span style="color: #28a745; font-weight: bold;">已审核</span>',
        'rejected': '<span style="color: #dc3545; font-weight: bold;">已拒绝</span>'
    };
    return statusMap[status] || '<span style="color: #6c757d; font-weight: bold;">未知</span>';
}

function showLoading() {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
}

function hideLoading() {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function showError(message) {
    alert('错误: ' + message);
}

function formatCurrency(amount) {
    return '¥' + (amount || 0).toLocaleString('zh-CN');
}

// 更新分页信息
function updatePagination() {
    const totalPages = Math.ceil(totalRecords / pageSize);
    const pageInfo = document.getElementById('page-info');
    const paginationInfo = document.getElementById('pagination-info');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    
    if (pageInfo) {
        pageInfo.textContent = `第 ${currentPage} 页`;
    }
    
    if (paginationInfo) {
        paginationInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页，总计 ${totalRecords} 条记录`;
    }
    
    if (prevButton) {
        prevButton.disabled = currentPage <= 1;
    }
    
    if (nextButton) {
        nextButton.disabled = currentPage >= totalPages;
    }
    
    console.log('分页信息更新:', {
        currentPage: currentPage,
        totalPages: totalPages,
        totalRecords: totalRecords,
        pageSize: pageSize
    });
}


// 打印功能
async function statsPrintStatsTable() {
    const kindergartenSelect = document.getElementById('stats-kindergarten-select');
    const quarter = document.getElementById('quarter-select').value;
    
    // 检查是否选择了季度
    if (!quarter) {
        alert('请先选择季度');
        return;
    }
    
    showLoading();
    
    try {
        // 生成打印内容
        const printContent = await generatePrintTable(quarter);
        
        // 打开打印窗口
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>东昌府区普惠托育补贴季度统计表</title>
            <style>
                body { 
                    font-family: "SimSun", "宋体", serif; 
                    font-size: 15px; 
                    margin: 10px 20px 5px 20px; 
                    line-height: 1.1; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 10px;  /* 减少底部间距 */
                    table-layout: fixed;
                    font-size: 20px;      /* 减小字体 */
                    line-height: 1.5;       /* 减少行高 */
                }
                th, td { 
                    border: 1px solid #000; 
                    padding: 1px 2px; 
                    text-align: center; 
                    height: 24px; 
                    vertical-align: middle;
                    font-size: 15px;
                }
                /* 所有表头行都变大 */
                thead th {
                    font-size: 13px;
                    font-weight: bold;
                }
                th { 
                    background-color: #f0f0f0; 
                    font-weight: bold; 
                    font-size: 12px;
                }
                /* 机构名称列 - 拉宽 */
                .col-name { 
                    width: 120px; 
                    min-width: 150px;
                }
                /* 负责人电话列 - 拉宽 */
                .col-contact { 
                    width: 140px; 
                    min-width: 160px;
                }
                /* √的格子缩小 */
                .col-type { 
                    width: 30px; 
                    min-width: 30px;
                }
                .col-category { 
                    width: 25px; 
                    min-width: 25px;
                }
                /* 托位数格子 */
                .col-capacity { 
                    width: 40px; 
                    min-width: 40px;
                }
                /* 月份格子 */
                .col-month { 
                    width: 35px; 
                    min-width: 35px;
                }
                /* 补贴金额格子 */
                .col-subsidy { 
                    width: 55px; 
                    min-width: 55px;
                }
                .text-left { 
                    text-align: left; 
                    padding-left: 6px;
                }
                .text-center { 
                    text-align: center; 
                }
                .header { 
                    text-align: center; 
                    font-size: 20px; 
                    font-weight: bold; 
                    margin-bottom: 8px; 
                    line-height: 1.2;
                    margin-top: -5px;
                }
                .sub-header { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 10px; 
                    font-size: 11px;
                    padding: 0 10px;
                }
                .note { 
                    margin-top: 15px; 
                    font-size: 11px; 
                    text-align: left;
                    padding-left: 5px;
                }
                /* √的样式 */
                .checkmark {
                    font-size: 14px;
                    font-weight: bold;
                    color: #000;
                }
                /* 序号列 */
                .col-index {
                    width: 30px;
                    min-width: 30px;
                }
                @media print {
                    body { 
                        margin: 15mm 10mm; 
                        font-size: 10pt; 
                    }
                    .no-print { 
                        display: none; 
                    }
                    table {
                        page-break-inside: auto;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <div class="no-print" style="margin-top: 20px; text-align: center;">
                <button onclick="window.print()" style="padding: 8px 16px; margin: 0 10px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer;">打印</button>
                <button onclick="window.close()" style="padding: 8px 16px; margin: 0 10px; background: #f0f0f0; border: 1px solid #d9d9d9; border-radius: 4px; cursor: pointer;">关闭</button>
            </div>
        </body>
        </html>
        `);
        console.log('内容写入完成');
        printWindow.document.close();
        console.log('打印窗口准备就绪');
        
    } catch (error) {
        console.error('打印失败 - 完整错误信息:', error);
        console.error('错误名称:', error.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        alert('打印失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 准备打印数据 - 根据选择的机构获取数据
async function preparePrintData(quarter) {
    const kindergartenSelect = document.getElementById('stats-kindergarten-select');
    const selectedKindergartenValue = kindergartenSelect.value;
    
    console.log('选择的机构值:', selectedKindergartenValue);
    
    // 如果选择了具体机构，只获取该机构数据
    if (selectedKindergartenValue && selectedKindergartenValue !== '') {
        // 获取选中的机构名称
        const selectedKindergartenName = kindergartenSelect.options[kindergartenSelect.selectedIndex].text;
        console.log('选择了具体机构:', selectedKindergartenName);
        
        // 只获取选中的机构数据
        const institutionData = await getInstitutionMonthlyData(selectedKindergartenName, quarter);
        console.log('获取到的机构数据:', institutionData);
        
        // 使用固定数据（暂时）
        const fixedInstitutionInfo = getFixedInstitutionInfo(selectedKindergartenName);
        
        return [{
            id: selectedKindergartenValue,
            name: selectedKindergartenName,
            contact: fixedInstitutionInfo.contact,
            type: fixedInstitutionInfo.type,
            category: fixedInstitutionInfo.category,
            capacity: fixedInstitutionInfo.capacity,
            secondChildCounts: institutionData.secondChildCounts,
            thirdChildCounts: institutionData.thirdChildCounts
        }];
    } 
    // 如果选择"全部托育机构"，获取所有机构数据
    else {
        console.log('选择了全部托育机构，获取所有机构数据');
        
        // 这里使用固定的机构数据
        const fixedInstitutions = [
            { id: 9, name: '鸿顺幼儿园', contact: '魏菲菲17763511199', type: '幼儿园托班', category: '民办', capacity: 60 },
            { id: 2, name: '昌润莲城幼儿园', contact: '郭娟15263526885', type: '幼儿园托班', category: '民办', capacity: 80 },
            { id: 14, name: '风貌街实验幼儿园', contact: '庞婷婷13468378654', type: '幼儿园托班', category: '公办', capacity: 60 },
            { id: 3, name: '博士林幼儿园', contact: '葛燕18806358787', type: '幼儿园托班', category: '民办', capacity: 60 },
            { id: 10, name: '区托育综合服务中心', contact: '阮树录15910192052', type: '托育机构', category: '公办', capacity: 150 },
            { id: 4, name: '双力幼儿园', contact: '岳福银13396229306', type: '幼儿园托班', category: '民办', capacity: 40 },
            { id: 13, name: '东关实验幼儿园', contact: '刘颖18365800123', type: '幼儿园托班', category: '公办', capacity: 20 },
            { id: 8, name: '东方幼稚园', contact: '仙树云18063581839', type: '幼儿园托班', category: '民办', capacity: 60 },
            { id: 12, name: '爱尔福托育中心', contact: '肖琳15117910864', type: '托育机构', category: '民办', capacity: 60 },
            { id: 7, name: '交运小蜗牛', contact: '申静静13793080077', type: '托育机构', category: '民办', capacity: 80 },
            { id: 1, name: '水岸新城幼儿园', contact: '韩越越15563559997', type: '幼儿园托班', category: '民办', capacity: 60 },
            { id: 11, name: '郑忠童蒙幼儿园', contact: '王文雅18963572018', type: '幼儿园托班', category: '民办', capacity: 60 },
            { id: 6, name: '交运托育服务有限公司', contact: '张亚娟18663510910', type: '幼儿园托班', category: '民办', capacity: 150 },
            { id: 5, name: '贝贝家托育中心', contact: '刘伟18063528567', type: '托育机构', category: '民办', capacity: 60 }
        ];

        console.log('开始准备所有机构打印数据，季度:', quarter);
        
        const institutionsWithData = [];
        for (const institution of fixedInstitutions) {
            console.log(`获取机构 ${institution.name} 的数据...`);
            
            const institutionData = await getInstitutionMonthlyData(institution.name, quarter);
            
            institutionsWithData.push({
                ...institution,
                secondChildCounts: institutionData.secondChildCounts,
                thirdChildCounts: institutionData.thirdChildCounts
            });
        }

        console.log('所有机构最终数据:', institutionsWithData);
        return institutionsWithData;
    }
}

// 获取固定机构信息
function getFixedInstitutionInfo(kindergartenName) {
    const fixedInstitutions = {
        '鸿顺鸿顺幼儿园': { contact: '魏菲菲17763511199', type: '幼儿园托班', category: '民办', capacity: 60 },
        '昌润莲城幼儿园': { contact: '郭娟15263526885', type: '幼儿园托班', category: '民办', capacity: 80 },
        '风貌街实验幼儿园': { contact: '庞婷婷13468378654', type: '幼儿园托班', category: '公办', capacity: 60 },
        '博士林幼儿园': { contact: '葛燕18806358787', type: '幼儿园托班', category: '民办', capacity: 60 },
        '区托育综合服务中心': { contact: '阮树录15910192052', type: '托育机构', category: '公办', capacity: 150 },
        '双力幼儿园': { contact: '岳福银13396229306', type: '幼儿园托班', category: '民办', capacity: 40 },
        '东关实验幼儿园': { contact: '刘颖18365800123', type: '幼儿园托班', category: '公办', capacity: 20 },
        '东方幼稚园': { contact: '仙树云18063581839', type: '幼儿园托班', category: '民办', capacity: 60 },
        '爱尔福托育中心': { contact: '肖琳15117910864', type: '托育机构', category: '民办', capacity: 60 },
        '交运小蜗牛': { contact: '申静静13793080077', type: '托育机构', category: '民办', capacity: 80 },
        '水岸新城幼儿园': { contact: '韩越越15563559997', type: '幼儿园托班', category: '民办', capacity: 60 },
        '郑忠童蒙幼儿园': { contact: '王文雅18963572018', type: '幼儿园托班', category: '民办', capacity: 60 },
        '交运托育服务有限公司': { contact: '张亚娟18663510910', type: '幼儿园托班', category: '民办', capacity: 150 },
        '贝贝家托育中心': { contact: '刘伟18063528567', type: '托育机构', category: '民办', capacity: 60 }
    };
    
    return fixedInstitutions[kindergartenName] || { contact: '暂无联系方式', type: '', category: '', capacity: 0 };
}
// 获取指定机构的所有孩次月度数据 - 这是正确的函数
async function getInstitutionMonthlyData(kindergartenName, quarter) {
    try {
        const requestData = {
            kindergarten: kindergartenName,
            quarter: quarter
        };
        
        console.log('发送机构数据请求:', requestData);
        
        const response = await fetch('http://localhost/kindergarten/getMonthlyStats.php', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`机构 ${kindergartenName} API返回完整数据:`, data);
        
        if (data.success) {
            console.log(`解析到的二孩数据:`, data.secondChildCounts);
            console.log(`解析到的三孩数据:`, data.thirdChildCounts);
            
            return {
                secondChildCounts: data.secondChildCounts || [0, 0, 0],
                thirdChildCounts: data.thirdChildCounts || [0, 0, 0]
            };
        } else {
            console.error('API返回错误:', data.message);
            return {
                secondChildCounts: [0, 0, 0],
                thirdChildCounts: [0, 0, 0]
            };
        }
        
    } catch (error) {
        console.error(`获取机构 ${kindergartenName} 数据失败:`, error);
        return {
            secondChildCounts: [0, 0, 0],
            thirdChildCounts: [0, 0, 0]
        };
    }
}


// 生成打印表格
async function generatePrintTable(quarter) {
    try {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        
        console.log('开始获取打印数据...');
        // 获取打印数据
        const printData = await preparePrintData(quarter);
        console.log('打印数据获取完成:', printData);
        
        const monthNames = getQuarterMonthNames(quarter);
        const quarterText = getQuarterText(quarter);
        
        console.log('开始计算合计数据...');
        // 计算合计数据
        const totals = await calculateTotals(printData, quarter);
        console.log('合计数据计算完成:', totals);
        
        console.log('开始生成表格行...');
        const tableRows = await generateTableRows(printData, quarter);
        console.log('表格行生成完成');
        
        return `
        <div class="header">东昌府区${quarterText}普惠性托育机构二孩、三孩保育费分档补贴表</div>
        <div class="sub-header">
            <div>填表单位：东昌府区卫生健康局</div>
            <div>填表日期：${year}年${month}月${day}日</div>
        </div>
        
        <table>
            <colgroup>
                <col class="col-index">
                <col class="col-name">
                <col class="col-contact">
                <col class="col-type">
                <col class="col-type">
                <col class="col-category">
                <col class="col-category">
                <col class="col-capacity">
                <col class="col-month">
                <col class="col-month">
                <col class="col-month">
                <col class="col-subsidy">
                <col class="col-month">
                <col class="col-month">
                <col class="col-month">
                <col class="col-subsidy">
            </colgroup>
            <thead>
                <tr>
                    <th rowspan="3">序号</th>
                    <th rowspan="3">机构名称</th>
                    <th rowspan="3">机构负责人及联系电话</th>
                    <th colspan="4">机构性质</th>
                    <th rowspan="3">普惠性托位数（个）</th>
                    <th rowspan="2" colspan="3">每月实际收托0-3岁婴幼儿（二孩人数）</th>
                    <th rowspan="3">本季度二孩补贴金额（万元）</th>
                    <th rowspan="2" colspan="3">每月实际收托0-3岁婴幼儿（三孩人数）</th>
                    <th rowspan="3">本季度三孩补贴金额（万元）</th>
                </tr>
                <tr>
                    <th colspan="2">类型</th>
                    <th colspan="2">举办类别</th>
                </tr>
                <tr>
                    <th>托育机构</th>
                    <th>幼儿园托班</th>
                    <th>公办</th>
                    <th>民办</th>
                    <th>${monthNames[0]}</th>
                    <th>${monthNames[1]}</th>
                    <th>${monthNames[2]}</th>
                    <th>${monthNames[0]}</th>
                    <th>${monthNames[1]}</th>
                    <th>${monthNames[2]}</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr>
                    <td colspan="7" style="text-align: center; font-weight: bold;">合计</td>
                    <td>${totals.capacity}</td>
                    <td>${totals.secondChild.month1}</td>
                    <td>${totals.secondChild.month2}</td>
                    <td>${totals.secondChild.month3}</td>
                    <td>${totals.secondChild.subsidy.toFixed(2)}</td>
                    <td>${totals.thirdChild.month1}</td>
                    <td>${totals.thirdChild.month2}</td>
                    <td>${totals.thirdChild.month3}</td>
                    <td>${totals.thirdChild.subsidy.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
        
        <div class="note">
            注：此表一式三份，县级卫生健康部门留存一份，县级财政部门、市卫健委各备案一份
        </div>
        `;
    } catch (error) {
        console.error('生成打印表格失败:', error);
        throw error;
    }
}

// 生成表格行
async function generateTableRows(data, quarter) {
    console.log('生成表格行，数据长度:', data.length);
    console.log('表格行数据:', data);
    
    if (!data || data.length === 0) {
        return '<tr><td colspan="16" style="text-align: center;">暂无数据</td></tr>';
    }
    
    let rows = '';
    
    for (let i = 0; i < data.length; i++) {
        const institution = data[i];
        console.log(`处理第${i+1}个机构:`, institution.name);
        
        // 添加默认值处理
        const secondChildCounts = institution.secondChildCounts || [0, 0, 0];
        const thirdChildCounts = institution.thirdChildCounts || [0, 0, 0];
        
        // 计算补贴金额
        const secondChildTotal = secondChildCounts.reduce((sum, count) => sum + (count || 0), 0);
        const secondChildSubsidy = (secondChildTotal * 300) / 10000;
        
        const thirdChildTotal = thirdChildCounts.reduce((sum, count) => sum + (count || 0), 0);
        const thirdChildSubsidy = (thirdChildTotal * 400) / 10000;
        
        rows += `
            <tr>
                <td>${i + 1}</td>
                <td class="text-left">${institution.name || ''}</td>
                <td class="text-left">${institution.contact || ''}</td>
                <td>${institution.type === '托育机构' ? '<span class="checkmark">√</span>' : ''}</td>
                <td>${institution.type === '幼儿园托班' ? '<span class="checkmark">√</span>' : ''}</td>
                <td>${institution.category === '公办' ? '<span class="checkmark">√</span>' : ''}</td>
                <td>${institution.category === '民办' ? '<span class="checkmark">√</span>' : ''}</td>
                <td>${institution.capacity || ''}</td>
                <td>${secondChildCounts[0] || 0}</td>
                <td>${secondChildCounts[1] || 0}</td>
                <td>${secondChildCounts[2] || 0}</td>
                <td>${secondChildSubsidy.toFixed(2)}</td>
                <td>${thirdChildCounts[0] || 0}</td>
                <td>${thirdChildCounts[1] || 0}</td>
                <td>${thirdChildCounts[2] || 0}</td>
                <td>${thirdChildSubsidy.toFixed(2)}</td>
            </tr>
        `;
    }
    
    console.log('生成的表格行数量:', data.length);
    return rows;
}

// 计算合计数据 - 添加错误处理
async function calculateTotals(data, quarter) {
    const totals = {
        capacity: 0,
        secondChild: { month1: 0, month2: 0, month3: 0, total: 0, subsidy: 0 },
        thirdChild: { month1: 0, month2: 0, month3: 0, total: 0, subsidy: 0 }
    };
    
    for (const institution of data) {
        // 添加默认值处理
        const secondChildCounts = institution.secondChildCounts || [0, 0, 0];
        const thirdChildCounts = institution.thirdChildCounts || [0, 0, 0];
        
        // 累加普惠性托位数
        totals.capacity += parseInt(institution.capacity) || 0;
        
        // 累加二孩数据 - 添加默认值处理
        totals.secondChild.month1 += secondChildCounts[0] || 0;
        totals.secondChild.month2 += secondChildCounts[1] || 0;
        totals.secondChild.month3 += secondChildCounts[2] || 0;
        
        // 累加三孩数据 - 添加默认值处理
        totals.thirdChild.month1 += thirdChildCounts[0] || 0;
        totals.thirdChild.month2 += thirdChildCounts[1] || 0;
        totals.thirdChild.month3 += thirdChildCounts[2] || 0;
    }
    
    // 计算二孩总和和补贴
    totals.secondChild.total = totals.secondChild.month1 + totals.secondChild.month2 + totals.secondChild.month3;
    totals.secondChild.subsidy = (totals.secondChild.total * 300) / 10000;
    
    // 计算三孩总和和补贴
    totals.thirdChild.total = totals.thirdChild.month1 + totals.thirdChild.month2 + totals.thirdChild.month3;
    totals.thirdChild.subsidy = (totals.thirdChild.total * 400) / 10000;
    
    return totals;
}

// 获取季度中文文本
function getQuarterText(quarter) {
    const quarterMap = {
        '1': '第一季度',
        '2': '第二季度', 
        '3': '第三季度',
        '4': '第四季度',
        'all': '全年'
    };
    return quarterMap[quarter] || '第一季度';
}

// 获取季度对应的月份名称
function getQuarterMonthNames(quarter) {
    const monthMap = {
        '1': ['1月', '2月', '3月'],
        '2': ['4月', '5月', '6月'],
        '3': ['7月', '8月', '9月'],
        '4': ['10月', '11月', '12月'],
        'all': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    };
    return monthMap[quarter] || monthMap['1'];
}

// 在页面中添加打印按钮
function addPrintButton() {
    const buttonContainer = document.querySelector('.stats-actions');
    if (buttonContainer && !document.getElementById('print-btn')) {
        const printButton = document.createElement('button');
        printButton.id = 'print-btn';
        printButton.textContent = '打印统计表';
        printButton.onclick = statsPrintStatsTable;
        printButton.style.marginLeft = '10px';
        printButton.style.padding = '8px 16px';
        printButton.style.backgroundColor = '#1890ff';
        printButton.style.color = 'white';
        printButton.style.border = 'none';
        printButton.style.borderRadius = '4px';
        printButton.style.cursor = 'pointer';
        buttonContainer.appendChild(printButton);
    }
}

// 在页面加载完成后添加打印按钮
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(addPrintButton, 1000);
});
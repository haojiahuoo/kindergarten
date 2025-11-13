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
            totalRecords = data.totalCount || 0;
            
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

function formatIdNumber(id) {
    if (!id || id.length !== 18) return id || '';
    return id.substring(0, 6) + '****' + id.substring(14);
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
// stats.js - 统计页面功能
let currentPage = 1;
let pageSize = 10;
let totalRecords = 0;
let currentData = [];

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    initStatsPage();
    // 页面加载完成后立即加载数据
    loadStatsData();
});

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
}

// 查询数据
function searchData() {
    currentPage = 1;
    loadStatsData();
}

// 加载统计数据
function loadStatsData() {
    const kindergarten = document.getElementById('stats-kindergarten-select').value;
    const birthOrder = document.getElementById('stats-birth-order').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const keyword = document.getElementById('keyword-search').value;
    
    showLoading();
    
    // 构建请求参数
    const requestData = {
        kindergarten: kindergarten,
        birthOrder: birthOrder,
        keyword: keyword,
        page: currentPage,
        pageSize: pageSize
    };
    
    // 只有在用户选择了时间时才添加时间条件
    if (startDate) {
        requestData.startDate = startDate;
    }
    if (endDate) {
        requestData.endDate = endDate;
    }
    
    console.log('发送统计请求:', requestData);
    
    // 发送API请求
    fetch('http://localhost/kindergarten/stats.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
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
                <td>${escapeHtml(record.motherName || '')}</td>
                <td>${formatDate(record.createTime)}</td>
                <td>${formatCurrency(record.subsidyAmount || 0)}</td>
                <td>${getStatusBadge(record.status || 'active')}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// 更新统计摘要
function updateStatsSummary(summary) {
    document.getElementById('total-people-count').textContent = (summary.totalCount || 0).toLocaleString();
    document.getElementById('total-subsidy-amount').textContent = formatCurrency(summary.totalSubsidy || 0);
    document.getElementById('second-child-count').textContent = (summary.secondChildCount || 0).toLocaleString();
    document.getElementById('second-child-subsidy').textContent = formatCurrency(summary.secondChildSubsidy || 0);
    document.getElementById('third-child-count').textContent = (summary.thirdChildCount || 0).toLocaleString();
    document.getElementById('third-child-subsidy').textContent = formatCurrency(summary.thirdChildSubsidy || 0);
    document.getElementById('kindergarten-count').textContent = (summary.kindergartenCount || 0).toLocaleString();
}

// 更新分页信息
function updatePagination() {
    const totalPages = Math.ceil(totalRecords / pageSize);
    const pageInfo = document.getElementById('page-info');
    const paginationInfo = document.getElementById('pagination-info');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    
    pageInfo.textContent = `第 ${currentPage} 页`;
    paginationInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页，总计 ${totalRecords} 条记录`;
    
    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
}

// 重置筛选条件
function resetFilters() {
    document.getElementById('stats-kindergarten-select').value = '';
    document.getElementById('stats-birth-order').value = '';
    document.getElementById('keyword-search').value = '';
    
    // 清空时间条件
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    
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
        1: '一孩',
        2: '二孩',
        3: '三孩及以上'
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
// stats.js - 统计页面功能
let currentPage = 1;
let pageSize = 10;
let totalRecords = 0;
let currentData = [];

// 日期格式化函数
function formatDate(dateString) {
    if (!dateString) return '';
    
    // 处理各种日期格式
    if (typeof dateString === 'string') {
        // YYYYMMDD 格式
        if (/^\d{8}$/.test(dateString)) {
            const year = dateString.substring(0, 4);
            const month = dateString.substring(4, 6);
            const day = dateString.substring(6, 8);
            return `${year}-${month}-${day}`;
        }
        
        // 处理带时间戳的日期
        if (dateString.includes('T') || dateString.includes(' ')) {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        // 其他格式直接返回
        return dateString;
    }
    
    // Date 对象
    if (dateString instanceof Date && !isNaN(date.getTime())) {
        const year = dateString.getFullYear();
        const month = String(dateString.getMonth() + 1).padStart(2, '0');
        const day = String(dateString.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    return String(dateString || '');
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    initStatsPage();
});

function initStatsPage() {
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
    
    // 绑定搜索事件
    document.getElementById('search-btn').addEventListener('click', searchData);
    
    // 绑定导出事件
    document.getElementById('export-btn').addEventListener('click', exportStatsData);
    
    // 默认加载数据
    loadStatsData();
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
    
    // 模拟API调用
    fetch('http://localhost/kindergarten/stats.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            kindergarten: kindergarten,
            birthOrder: birthOrder,
            startDate: startDate,
            endDate: endDate,
            keyword: keyword,
            page: currentPage,
            pageSize: pageSize
        })
    })
    .then(response => response.json())
    .then(data => {
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

// 渲染数据表格（更新列）
function renderStatsTable() {
    const tbody = document.getElementById('stats-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (currentData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; color: #999; padding: 20px;">
                    暂无数据
                </td>
            </tr>
        `;
        return;
    }
    
    currentData.forEach((item, index) => {
        const row = document.createElement('tr');
        const serialNumber = (currentPage - 1) * pageSize + index + 1;
        
        row.innerHTML = `
            <td>${serialNumber}</td>
            <td>${item.childName || ''}</td>
            <td>${item.birthOrder || ''}孩</td>
            <td>${formatIdNumber(item.childId || '')}</td>
            <td>${item.kindergarten || ''}</td>
            <td>${item.fatherName || ''}</td>
            <td>${item.motherName || ''}</td>
            <td>${formatDate(item.createTime) || ''}</td>
            <td>${formatCurrency(item.subsidyAmount || 0)}</td>
            <td>${getStatusBadge(item.status)}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// 更新分页信息
function updatePagination() {
    const totalPages = Math.ceil(totalRecords / pageSize);
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const paginationInfo = document.getElementById('pagination-info');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (pageInfo) pageInfo.textContent = `第 ${currentPage} 页`;
    if (paginationInfo) paginationInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页，${totalRecords} 条记录`;
}

// 更新统计摘要
function updateStatsSummary(summary) {
    const elements = {
        'total-people-count': summary.totalCount || 0,
        'total-subsidy-amount': formatCurrency(summary.totalSubsidy || 0),
        'second-child-count': summary.secondChildCount || 0,
        'second-child-subsidy': formatCurrency(summary.secondChildSubsidy || 0),
        'third-child-count': summary.thirdChildCount || 0,
        'third-child-subsidy': formatCurrency(summary.thirdChildSubsidy || 0),
        'kindergarten-count': summary.kindergartenCount || 0
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

// 导出数据
function exportStatsData() {
    if (currentData.length === 0) {
        alert('没有数据可导出');
        return;
    }
    
    try {
        // 创建CSV格式数据
        const headers = ['序号', '孩子姓名', '孩次', '身份证号', '托育机构', '父亲姓名', '母亲姓名', '创建时间', '补贴金额', '状态'];
        const csvData = [headers];
        
        currentData.forEach((item, index) => {
            const row = [
                index + 1,
                item.childName || '',
                (item.birthOrder || '') + '孩',
                item.childId || '',
                item.kindergarten || '',
                item.fatherName || '',
                item.motherName || '',
                formatDate(item.createTime) || '',
                item.subsidyAmount || 0,
                getStatusText(item.status)
            ];
            csvData.push(row);
        });
        
        const csvContent = csvData.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `统计数据_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('导出失败:', error);
        showError('导出数据失败: ' + error.message);
    }
}

// 辅助函数
function formatIdNumber(id) {
    if (!id || id.length !== 18) return id || '';
    return id.substring(0, 6) + '****' + id.substring(14);
}

function getStatusBadge(status) {
    const statusMap = {
        'active': '<span class="status-success">正常</span>',
        'inactive': '<span class="status-warning">停用</span>',
        'pending': '<span class="status-warning">待审核</span>',
        'approved': '<span class="status-success">已审核</span>',
        'rejected': '<span class="status-error">已拒绝</span>'
    };
    return statusMap[status] || '<span class="status-error">未知</span>';
}

function getStatusText(status) {
    const statusMap = {
        'active': '正常',
        'inactive': '停用',
        'pending': '待审核',
        'approved': '已审核',
        'rejected': '已拒绝'
    };
    return statusMap[status] || '未知';
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
    alert(message); // 可以替换为更友好的提示方式
    console.error('Error:', message);
}

// 格式化货币显示
function formatCurrency(amount) {
    return '¥' + (amount || 0).toLocaleString('zh-CN');
}

// 重置筛选条件
function resetFilters() {
    document.getElementById('stats-kindergarten-select').value = '';
    document.getElementById('stats-birth-order').value = '';
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('keyword-search').value = '';
    
    currentPage = 1;
    loadStatsData();
}

// 添加重置按钮事件监听（如果HTML中有重置按钮）
document.addEventListener('DOMContentLoaded', function() {
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
});
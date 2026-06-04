const BASE_URL = window.location.origin;
let isRunning = false;

const DEFAULT_HOPS = {
    '8081': '23',
    '8082': '13',
    '8083': '12'
};

function onPortChange() {
    const port = document.getElementById('entry-point').value;
    const hopInput = document.getElementById('hop-route');
    const hopEnabled = document.getElementById('hop-enabled');
    
    if (hopEnabled.checked) {
        hopInput.value = DEFAULT_HOPS[port];
    }
    updateCurlCommands();
}

function toggleHopInput() {
    const checkbox = document.getElementById('hop-enabled');
    const input = document.getElementById('hop-route');
    const port = document.getElementById('entry-point').value;
    
    if (checkbox.checked) {
        input.value = DEFAULT_HOPS[port];
    } else {
        input.value = '';
    }
    updateCurlCommands();
}

function filterHopInput(input) {
    const filtered = input.value.replace(/[^123]/g, '');
    if (filtered !== input.value) {
        input.value = filtered;
    }
    updateCurlCommands();
}

function filterIpInput(input) {
    let value = input.value.replace(/[^0-9.]/g, '');
    value = value.replace(/\.\.+/g, '.');
    if (value.startsWith('.')) value = value.substring(1);
    
    const parts = value.split('.');
    const validParts = parts.map((part) => {
        if (part === '') return part;
        const num = parseInt(part, 10);
        if (num > 255) return '255';
        return part;
    });
    
    const filtered = validParts.slice(0, 4).join('.');
    if (filtered !== input.value) {
        input.value = filtered;
    }
    updateCurlCommands();
}

function updateCurlCommands() {
    const port = document.getElementById('entry-point').value;
    const hopEnabled = document.getElementById('hop-enabled').checked;
    const hopValue = document.getElementById('hop-route').value.trim();
    const xff = document.getElementById('xff-header').value;
    
    const route = hopEnabled && hopValue ? `/hop/${hopValue}` : '/';
    const url = `http://test.z17.ru:${port}${route}`;
    
    let xffFlag = '';
    if (xff) {
        xffFlag = `-H "X-Forwarded-For: ${xff}" `;
    }
    
    const linuxCmd = `curl -s ${xffFlag}${url} | jq .`;
    const windowsCmd = `curl.exe -s ${xffFlag}${url} | jq .`;
    
    const container = document.getElementById('curl-commands');
    container.innerHTML = `
        <div class="os-label">Linux:</div>
        <code onclick="copyToClipboard(this)" title="Click to copy">${linuxCmd}</code>
        <div class="os-label">Windows:</div>
        <code onclick="copyToClipboard(this)" title="Click to copy">${windowsCmd}</code>
    `;
}

function copyToClipboard(element) {
    const text = element.textContent.trim();
    
    // Универсальный способ копирования (работает и по HTTP)
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);

    // Визуальный эффект
    const originalBg = element.style.background;
    const originalColor = element.style.color;
    const originalText = element.textContent;
    
    element.style.background = '#00d9a3';
    element.style.color = '#000';
    element.textContent = '✓ Copied!';
    
    setTimeout(() => {
        element.style.background = originalBg;
        element.style.color = originalColor;
        element.textContent = originalText;
    }, 800);
}

function log(msg, type = 'info') {
    const consoleDiv = document.getElementById('console');
    if (!consoleDiv) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type === 'error' ? 'log-error' : ''}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    consoleDiv.appendChild(entry);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function getServerName(ip) {
    const map = { 
        '10.89.0.11': 'Nginx 1', 
        '10.89.0.12': 'Nginx 2', 
        '10.89.0.13': 'Nginx 3', 
        '10.89.0.10': 'App (Whoami)' 
    };
    return map[ip] || null;
}

function createHopCard(index, currentIp, nextIp, xffChain, isLast, isFirst, entryPort) {
    const card = document.createElement('div');
    card.className = `hop-card ${isLast ? 'final' : ''}`;
    card.style.animationDelay = `${index * 0.1}s`;
    
    const label = isFirst ? `Entry: ${entryPort}` : `Hop #${index}`;
    const currentName = getServerName(currentIp) || 'Client';
    const nextName = isLast ? 'APP (Final)' : (getServerName(nextIp) || nextIp);
    
    card.innerHTML = `
        <div class="hop-header">
            <div class="hop-number">${label}</div>
            <div class="hop-server">${currentIp}</div>
        </div>
        <div class="hop-route">
            <strong>${currentName}</strong> → ${nextName}
        </div>
        <div class="hop-details">
            <div class="detail-row"><div class="detail-label">From:</div><div class="detail-value">${currentName} (${currentIp})</div></div>
            <div class="detail-row"><div class="detail-label">To:</div><div class="detail-value">${isLast ? 'App' : nextName} (${isLast ? '10.89.0.10' : nextIp})</div></div>
            <div class="detail-row"><div class="detail-label">XFF:</div><div class="detail-value">${xffChain || '-'}</div></div>
        </div>
    `;
    card.onclick = () => card.classList.toggle('expanded');
    return card;
}

async function runSimulation() {
    if (isRunning) return;
    isRunning = true;
    
    const btn = document.getElementById('btn-run');
    const port = document.getElementById('entry-point').value;
    const hopEnabled = document.getElementById('hop-enabled').checked;
    const hopValue = document.getElementById('hop-route').value.trim();
    const xff = document.getElementById('xff-header').value;
    const timeline = document.getElementById('timeline');
    
    btn.disabled = true;
    document.getElementById('console').innerHTML = '';
    timeline.innerHTML = '<div class="empty-state">Processing...</div>';
    
    const baseUrl = BASE_URL.replace(/:\d+$/, '');
    const route = hopEnabled && hopValue ? `/hop/${hopValue}` : '/';
    const targetUrl = `${baseUrl}:${port}${route}`;
    
    log(`Request: ${targetUrl}`);

    try {
        const headers = {};
        if (xff) {
            headers['X-Forwarded-For'] = xff;
        }
        
        const res = await fetch(targetUrl, { headers });
        const data = await res.json();
        
        log(`Response received`, 'success');

        const xffHeader = data.headers['X-Forwarded-For']?.[0] || '';
        const ipChain = xffHeader.split(',').map(ip => ip.trim()).filter(ip => ip);
        
        log(`Chain: ${ipChain.length} hops`, 'success');

        if (ipChain.length === 0) {
            timeline.innerHTML = '<div class="empty-state">No hops found</div>';
            return;
        }

        timeline.innerHTML = '';
        ipChain.forEach((ip, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === ipChain.length - 1;
            const nextIp = isLast ? null : ipChain[idx + 1];
            const xffChain = ipChain.slice(0, idx + 1).join(', ');
            timeline.appendChild(createHopCard(idx, ip, nextIp, xffChain, isLast, isFirst, port));
        });

        document.getElementById('stat-hops').textContent = ipChain.length;
        document.getElementById('stat-time').textContent = '-';
        document.getElementById('stat-status').textContent = '200';
        
        log(`Done! ${ipChain.length} hops`, 'success');

    } catch (e) {
        log(`Error: ${e.message}`, 'error');
        timeline.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    } finally {
        isRunning = false;
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    onPortChange();
});

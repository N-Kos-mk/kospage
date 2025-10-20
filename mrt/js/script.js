document.addEventListener("DOMContentLoaded", () => {
    // ===== タブの自動生成 =====
    const pages = document.querySelectorAll('.funcpage');
    const tabbar = document.getElementById('tabbar');

    pages.forEach((page, index) => {
        const title = page.querySelector('.functitle')?.textContent || `タブ${index+1}`;
        const btn = document.createElement('button');
        btn.textContent = title;
        btn.addEventListener('click', () => showTab(index));
        tabbar.appendChild(btn);
    });

    function showTab(index) {
        pages.forEach((page, i) => {
        page.classList.toggle('active', i === index);
        tabbar.children[i].classList.toggle('active', i === index);
        });
    }

    // 初期タブ
    showTab(0);

    // ===== タイマー機能 =====
    /*let timerInterval;
    function startTimer() {
        clearInterval(timerInterval);
        let sec = parseInt(document.getElementById('timerSec').value);
        const display = document.getElementById('timerDisplay');
        display.textContent = `残り: ${sec}秒`;
        timerInterval = setInterval(() => {
        sec--;
        display.textContent = `残り: ${sec}秒`;
        if (sec <= 0) {
            clearInterval(timerInterval);
            alert("時間です！");
            display.textContent = "完了！";
        }
        }, 1000);
    }*/
});
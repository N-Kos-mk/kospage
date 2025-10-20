document.addEventListener('DOMContentLoaded', () => {

    // --- 要素の取得 ---
    // 左側（エディタ）
    const catchcopyInput = document.getElementById('tc-catchcopy');
    const introInput = document.getElementById('tc-intro');
    const featuresInput = document.getElementById('tc-features');
    const specsBody = document.getElementById('tc-specs-body');
    const addSpecBtn = document.getElementById('tc-add-spec');
    
    // ★追加: 削除ボタン
    const clearAllBtn = document.getElementById('tc-clear-all');
    const clearFieldBtns = document.querySelectorAll('.tc-clear-field');

    // 右側（プレビュー）
    const previewBox = document.getElementById('tc-preview');
    const copyBtn = document.getElementById('tc-copy-btn');
    
    // --- (v2) escapeHTML, loadFromLocalStorage, saveToLocalStorage ---

    /**
     * (v2) HTMLエスケープ関数 (XSS対策)
     */
    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    /**
     * (v2) LocalStorageからデータを読み込み (★行削除ボタン追加のため変更)
     */
    function loadFromLocalStorage() {
        try {
            // 1. テキスト入力 (v2のまま)
            const savedCatchcopy = localStorage.getItem('tc_catchcopy');
            if (savedCatchcopy !== null) {
                catchcopyInput.value = savedCatchcopy;
            }
            const savedIntro = localStorage.getItem('tc_intro');
            if (savedIntro !== null) {
                introInput.value = savedIntro;
            }
            const savedFeatures = localStorage.getItem('tc_features');
            if (savedFeatures !== null) {
                featuresInput.value = savedFeatures;
            }
            
            // 2. 仕様テーブル (★変更)
            const savedSpecs = localStorage.getItem('tc_specs');
            if (savedSpecs) {
                const specsData = JSON.parse(savedSpecs);
                
                if (specsData && specsData.length > 0) {
                    specsBody.innerHTML = ''; // デフォルト行をクリア
                    specsData.forEach(item => {
                        const tr = document.createElement('tr');
                        // ★変更: 削除ボタンのセルを追加
                        tr.innerHTML = `
                            <td><input type="text" placeholder="項目名" value="${escapeHTML(item.key)}"></td>
                            <td><input type="text" placeholder="値" value="${escapeHTML(item.value)}"></td>
                            <td class="tc-spec-actions">
                                <button type="button" class="tc-remove-spec-row">×</button>
                            </td>
                        `;
                        specsBody.appendChild(tr);
                    });
                }
                // ★追加: もしLocalStorageのデータが0件でも、HTMLデフォルト行が削除されているので空行を追加
                if (specsBody.querySelectorAll('tr').length === 0) {
                    addSpecRow(false); // 保存しない
                }
            }
            
        } catch (e) {
            console.error('LocalStorageからの読み込みに失敗しました:', e);
        }
    }

    /**
     * (v2) データをLocalStorageに保存
     */
    function saveToLocalStorage() {
        try {
            // 1. テキスト入力 (v2のまま)
            localStorage.setItem('tc_catchcopy', catchcopyInput.value);
            localStorage.setItem('tc_intro', introInput.value);
            localStorage.setItem('tc_features', featuresInput.value);
            
            // 2. 仕様テーブル (v2のまま)
            const specsData = [];
            const rows = specsBody.querySelectorAll('tr');
            
            rows.forEach(row => {
                const inputs = row.querySelectorAll('input');
                specsData.push({
                    key: inputs[0].value,
                    value: inputs[1].value
                });
            });
            
            localStorage.setItem('tc_specs', JSON.stringify(specsData));
            
        } catch (e) {
            console.error('LocalStorageへの保存に失敗しました:', e);
        }
    }

    
    // --- イベントリスナーの設定 ---
    
    // 1. 1行テキストエリア (v2のまま)
    [catchcopyInput, introInput].forEach(el => {
        el.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\n/g, '');
            updatePreview();
            saveToLocalStorage();
        });
    });
    
    // 2. 特長テキストエリア (v2のまま)
    featuresInput.addEventListener('input', () => {
        handleFeaturesValidation();
        updatePreview();
        saveToLocalStorage();
    });
    
    // 3. 仕様テーブル（入力 ＋ ★行削除）
    specsBody.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT') {
            updatePreview();
            saveToLocalStorage();
        }
    });
    
    // ★追加: 仕様テーブルの行削除（イベント委任）
    specsBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('tc-remove-spec-row')) {
            e.target.closest('tr').remove();
            
            // ★追加: もしテーブルが空になったら、新しい空行を1行追加
            if (specsBody.querySelectorAll('tr').length === 0) {
                addSpecRow(false); // 保存はしない（次のsaveToLocalStorageで行う）
            }
            
            updatePreview();
            saveToLocalStorage();
        }
    });

    // 4. 仕様追加ボタン (v2のまま)
    addSpecBtn.addEventListener('click', () => addSpecRow(true)); // ★引数を追加
    
    // 5. コピーボタン (v2のまま)
    copyBtn.addEventListener('click', copyPreviewHTML);

    // 6. ★追加: 全入力クリアボタン
    clearAllBtn.addEventListener('click', () => {
        if (confirm("すべての入力内容をクリアします。よろしいですか？")) {
            clearAllInputs();
        }
    });
    
    // 7. ★追加: 各フィールドクリアボタン
    clearFieldBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            
            if (targetId === 'tc-specs-body') {
                // 仕様テーブルのリセット
                resetSpecTable();
            } else {
                // 通常のtextarea
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.value = '';
                    
                    // 特長の場合は「・」を再入力
                    if (targetId === 'tc-features') {
                        handleFeaturesValidation();
                    }
                }
            }
            
            updatePreview();
            saveToLocalStorage();
        });
    });

    
    // --- 関数定義 ---
    
    /**
     * (v1) 特長テキストエリアのバリデーション
     */
    function handleFeaturesValidation() {
        // (v1のまま)
        const value = featuresInput.value;
        if (value.trim() === '') {
            featuresInput.value = '・';
            featuresInput.classList.remove('error');
            return;
        }
        const lines = value.split('\n');
        let hasError = false;
        for (let i = 0; i < lines.length; i++) {
            if (i === 0 || lines[i].trim() === '') {
                continue;
            }
            if (!lines[i].startsWith('・')) {
                hasError = true;
                break;
            }
        }
        if (hasError) {
            featuresInput.classList.add('error');
        } else {
            featuresInput.classList.remove('error');
        }
    }
    
    /**
     * 仕様テーブルに行を追加
     * (v2から変更: ★行削除ボタンの追加, ★保存フラグの追加)
     * @param {boolean} [doSave=true] - 実行後にLocalStorageに保存するか
     */
    function addSpecRow(doSave = true) {
        const tr = document.createElement('tr');
        // ★変更: 削除ボタンのセルを追加
        tr.innerHTML = `
            <td><input type="text" placeholder="項目名"></td>
            <td><input type="text" placeholder="値"></td>
            <td class="tc-spec-actions">
                <button type="button" class="tc-remove-spec-row">×</button>
            </td>
        `;
        specsBody.appendChild(tr);
        
        if (doSave) {
            saveToLocalStorage(); // (v2の処理)
        }
    }
    
    /**
     * ★追加: 仕様テーブルをリセット（空の1行）
     */
    function resetSpecTable() {
        specsBody.innerHTML = ''; // 全行削除
        addSpecRow(false); // 空の1行を追加（保存は呼び出し元で行う）
    }

    /**
     * ★追加: すべての入力をクリア
     */
    function clearAllInputs() {
        catchcopyInput.value = '';
        introInput.value = '';
        featuresInput.value = '';
        
        resetSpecTable();
        
        handleFeaturesValidation(); // 特長を「・」に戻す
        updatePreview();
        saveToLocalStorage();
    }

    /**
     * (v1) プレビューエリアを更新
     */
    function updatePreview() {
        // (v1のまま)
        let htmlString = '';
        const catchcopyVal = catchcopyInput.value.trim();
        if (catchcopyVal) {
            htmlString += `<h3>${escapeHTML(catchcopyVal)}</h3>\n`;
        }
        const introVal = introInput.value.trim();
        if (introVal) {
            htmlString += `<p>${escapeHTML(introVal)}</p>\n`;
        }
        const featuresVal = featuresInput.value.trim();
        if (featuresVal) {
            const featuresHTML = escapeHTML(featuresVal).replace(/\n/g, '<br>\n');
            htmlString += `<h3>●特長</h3>\n<p>${featuresHTML}</p>\n`;
        }
        
        let tableContent = '';
        let hasSpecContent = false;
        const rows = specsBody.querySelectorAll('tr');
        rows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            const key = inputs[0].value.trim();
            const value = inputs[1].value.trim();
            if (key || value) {
                tableContent += `<tr><td>${escapeHTML(key)}</td><td>${escapeHTML(value)}</td></tr>\n`;
                hasSpecContent = true;
            }
        });
        if (hasSpecContent) {
            htmlString += `<table>
<colgroup style="width:30%; background-color:#eeeeee;"></colgroup>
<colgroup style="width:70%; background-color:#ffffff;"></colgroup>
<tbody>
${tableContent}
</tbody>
</table>`;
        }
        previewBox.innerHTML = htmlString;
    }

    /**
     * (v1) クリップボードにプレビューのHTMLをコピー
     */
    function copyPreviewHTML() {
        // (v1のまま)
        const htmlToCopy = previewBox.innerHTML;
        if (!htmlToCopy) {
            alert('コピーする内容がありません。');
            return;
        }
        navigator.clipboard.writeText(htmlToCopy).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'コピーしました！';
            copyBtn.style.backgroundColor = '#28a745';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.backgroundColor = '#007bff';
            }, 2000);
        }).catch(err => {
            console.error('コピーに失敗しました: ', err);
            alert('コピーに失敗しました。');
        });
    }

    // --- 初期化 ---
    
    // (v2) LocalStorageから読み込み
    loadFromLocalStorage(); 

    // (v1) 初期バリデーションとプレビュー実行
    handleFeaturesValidation();
    updatePreview();
});
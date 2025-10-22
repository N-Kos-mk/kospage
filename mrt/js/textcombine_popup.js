document.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.querySelector("#textcombine .funcbody #openPopupBtn");
    const overlay = document.querySelector("#textcombine .funcbody #popupOverlay");
    const popup = document.querySelector("#textcombine .funcbody #popupWindow");
    const cancelBtn = document.querySelector("#textcombine .funcbody #cancelBtn");
    const confirmBtn = document.querySelector("#textcombine .funcbody #confirmBtn");
    
    const preStart = document.querySelector("#textcombine .funcbody #preStart");
    const preEnd = document.querySelector("#textcombine .funcbody #preEnd");
    const postStart = document.querySelector("#textcombine .funcbody #postStart");
    const textarea = document.querySelector("#textcombine .funcbody #popupTextarea");
    const specsBody = document.getElementById('tc-specs-body');

    const pasteBtn = document.querySelector("#textcombine .funcbody #loadClipboardBtn");
  
    // ポップアップを開く
    openBtn.addEventListener("click", () => {
      overlay.style.display = "block";
      popup.style.display = "block";
    });
  
    // 閉じる関数
    const closePopup = () => {
      overlay.style.display = "none";
      popup.style.display = "none";
    };
  
    // 背景クリック or キャンセルボタンで閉じる
    overlay.addEventListener("click", closePopup);
    cancelBtn.addEventListener("click", closePopup);
  
    // 決定ボタン処理
    function extractTableText(p1, p2, p3, text) {
    // 改行コードの違い（Windows / mac / Linux）に対応
    const lines = text.replace(/\r\n/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);
    const result = [];

    for (const line of lines) {
        const start1 = line.indexOf(p1);
        const end1 = line.indexOf(p2, start1 + p1.length);
        const start2 = line.indexOf(p3);

        // 3つの区切りがすべて存在する場合のみ処理
        if (start1 !== -1 && end1 !== -1 && start2 !== -1 && end1 >= start1 && start2 >= end1) {
        const key = line.substring(start1 + p1.length, end1).trim();
        const value = line.substring(start2 + p3.length).trim();
        result.push([key, value]);
        }
    }

    return result;
    }

    // ▼ 決定ボタン処理（書き直し）
    confirmBtn.addEventListener("click", () => {
        const text = textarea.value;
        const p1 = preStart.value;
        const p2 = preEnd.value;
        const p3 = postStart.value;

        const result = extractTableText(p1, p2, p3, text);
        console.log(result);

        closePopup();
    });


    pasteBtn.addEventListener('click', async () => {      
        // Clipboard API の存在チェック
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          setError('このブラウザは Clipboard API の readText をサポートしていません。代替方法を試してください。');
          setStatus('');
          return;
        }
      
        try {
          // 読み取りはユーザー操作（この click ハンドラ内）で呼ぶこと
          const text = await navigator.clipboard.readText();
          textarea.value = text;
        } catch (err) {
          // 権限拒否やその他のエラー
          console.error(err);
          alert('クリップボードの読み取りに失敗しました: ' + (err && err.message ? err.message : String(err)));
        }
    });

    function saveToLocalStorage_popup() {
        try {
            const p1 = preStart.value;
            const p2 = preEnd.value;
            const p3 = postStart.value;
            localStorage.setItem('tc_features_popup_1', p1);
            localStorage.setItem('tc_features_popup_2', p2);
            localStorage.setItem('tc_features_popup_3', p3);
            
        } catch (e) {
            console.error('LocalStorageへの保存に失敗しました(popup):', e);
        }
    }

    preStart.addEventListener('input', saveToLocalStorage_popup);
    preEnd.addEventListener('input', saveToLocalStorage_popup);
    postStart.addEventListener('input', saveToLocalStorage_popup);

    function loadFromLocalStorage () {
        try {
            const savedFeatures_popup_1 = localStorage.getItem('tc_features_popup_1');
            if (savedFeatures_popup_1 !== null) {
                preStart.value = savedFeatures_popup_1;
            }
            const savedFeatures_popup_2 = localStorage.getItem('tc_features_popup_2');
            if (savedFeatures_popup_2 !== null) {
                preEnd.value = savedFeatures_popup_2;
            }
            const savedFeatures_popup_3 = localStorage.getItem('tc_features_popup_3');
            if (savedFeatures_popup_3 !== null) {
                postStart.value = savedFeatures_popup_3;
            }
        } catch (e) {
            console.error('LocalStorageからの読み込みに失敗しました(popup):', e);
        }
    }

    function addSpecRowFromText(doSave = true) {
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
            saveToLocalStorage_popup(); // (v2の処理)
        }
    }
    loadFromLocalStorage();
});
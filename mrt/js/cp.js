// すべての処理を #cp .funcbody 内で完結させるため、
// DOMContentLoadedを待ってから要素を取得します。
document.addEventListener('DOMContentLoaded', () => {

    // #cp .funcbody 内の要素を取得
    const funcBody = document.querySelector('#cp .funcbody');
    if (!funcBody) return; // funcBodyがなければ何もしない

    const blocksContainer = funcBody.querySelector('#blocks-container');
    const addBtn = funcBody.querySelector('#add-block-btn');
    const resetAllBtn = funcBody.querySelector('#reset-all-btn');
    const saveBtn = funcBody.querySelector('#save-btn');
    const copyBtn = funcBody.querySelector('#copy-btn');

    const LOCAL_STORAGE_KEY = 'htmlBuilderBlocks';

    let draggingElement = null; // ドラッグ中の要素を保持

    /**
     * 新しいブロックを作成してコンテナに追加する
     * @param {string} startValue - (オプション) HTMLセレクタ(開始)の初期値
     * @param {string} endValue - (オプション) HTMLセレクタ(終了)の初期値
     */
    function createBlock(startValue = '', endValue = '') { // 変更: 引数
        const block = document.createElement('div');
        block.className = 'block';
        block.draggable = true; // ドラッグ可能にする

        // 変更: セレクタ(開始)
        const selectorStartInput = document.createElement('input');
        selectorStartInput.type = 'text';
        selectorStartInput.className = 'selector-start'; // クラス名変更
        selectorStartInput.placeholder = 'htmlセレクタ(開始) (例: <h3>)';
        selectorStartInput.value = startValue;


        const contentArea = document.createElement('textarea');
        contentArea.className = 'content';
        contentArea.placeholder = '内容';

        // 追加: セレクタ(終了)
        const selectorEndInput = document.createElement('input');
        selectorEndInput.type = 'text';
        selectorEndInput.className = 'selector-end'; // クラス名追加
        selectorEndInput.placeholder = 'htmlセレクタ(終了) (例: </h3>)';
        selectorEndInput.value = endValue;


        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '削除';

        // ブロック削除機能
        deleteBtn.addEventListener('click', () => {
            block.remove();
        });

        // ドラッグイベント
        block.addEventListener('dragstart', handleDragStart);
        block.addEventListener('dragend', handleDragEnd);

        block.appendChild(selectorStartInput);
        block.appendChild(contentArea);
        block.appendChild(selectorEndInput); // 追加
        block.appendChild(deleteBtn);

        // ドラッグ
        // dragstart イベントの制御
        block.addEventListener("dragstart", (e) => {
            // ドラッグ発火元が「自分自身」ではなく「子要素」の場合、キャンセル
            if (e.target !== block) {
            e.preventDefault();
            return;
            }
        });

        // Safari用: 子要素のネイティブドラッグを無効化
        block.querySelectorAll("*").forEach((child) => {
            child.style.webkitUserDrag = "none";
        });

        blocksContainer.appendChild(block);
    }

    // --- ドラッグアンドドロップ処理 ---

    function handleDragStart(e) {
        // dataTransfer を設定しないと Firefox などでドラッグが開始しない
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', null); // Firefoxのバグ回避
        
        draggingElement = e.target;
        // 少し遅延させてからクラスを適用（ドラッグゴーストに影響させないため）
        setTimeout(() => {
            draggingElement.classList.add('dragging');
        }, 0);
    }

    function handleDragEnd() {
        if (draggingElement) {
            draggingElement.classList.remove('dragging');
            draggingElement = null;
        }
        // 残っている可能性のある隙間インジケータをすべて削除
        funcBody.querySelectorAll('.drag-over').forEach(indicator => {
            indicator.remove();
        });
    }

    // コンテナ上でのドラッグイベント
    blocksContainer.addEventListener('dragover', (e) => {
        e.preventDefault(); // ドロップを許可するために必須
        
        if (!draggingElement) return;

        // 既存のインジケータを削除
        funcBody.querySelectorAll('.drag-over').forEach(indicator => {
            indicator.remove();
        });

        // 最も近い要素を見つける
        const afterElement = getDragAfterElement(blocksContainer, e.clientY);

        // 青い隙間（インジケータ）を作成
        const indicator = document.createElement('div');
        indicator.className = 'drag-over';

        if (afterElement == null) {
            // 末尾に挿入
            blocksContainer.appendChild(indicator);
        } else {
            // afterElementの直前に挿入
            blocksContainer.insertBefore(indicator, afterElement);
        }
    });

    blocksContainer.addEventListener('drop', (e) => {
        e.preventDefault(); // デフォルト動作（リンクとして開くなど）をキャンセル
        
        // 隙間インジケータを削除
        funcBody.querySelectorAll('.drag-over').forEach(indicator => {
            indicator.remove();
        });

        if (!draggingElement) return;

        // ドロップ位置に最も近い要素を取得
        const afterElement = getDragAfterElement(blocksContainer, e.clientY);
        
        if (afterElement == null) {
            blocksContainer.appendChild(draggingElement);
        } else {
            blocksContainer.insertBefore(draggingElement, afterElement);
        }
    });

    /**
     * Y座標に基づいて、ドラッグ中の要素をどの要素の前に挿入すべきかを判断する
     * @param {HTMLElement} container - コンテナ要素
     * @param {number} y - マウスのY座標
     * @returns {HTMLElement|null} - 挿入位置の基準となる要素 (nullの場合は末尾)
     */
    function getDragAfterElement(container, y) {
        // ドラッグ中の要素以外の兄弟要素を取得
        const draggableElements = [...container.querySelectorAll('.block:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // 要素の中心Y座標
            const offset = y - box.top - box.height / 2;

            // offsetが0に最も近く、かつ負の値（＝カーソルが要素の上半分にある）の要素を探す
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }


    // --- ボタン機能 ---

    // ブロック追加
    addBtn.addEventListener('click', () => {
        createBlock();
    });

    // 全リセット
    resetAllBtn.addEventListener('click', () => {
        if (confirm('すべてのブロックを削除しますか？ (保存されたデータは消えません)')) {
            blocksContainer.innerHTML = '';
        }
    });

    // 保存 (変更)
    saveBtn.addEventListener('click', () => {
        const blocksData = [];
        // #cp .funcbody 内の .block を取得
        funcBody.querySelectorAll('.block').forEach(block => {
            const startVal = block.querySelector('.selector-start').value;
            const endVal = block.querySelector('.selector-end').value;
            // textareaの内容は保存しない
            blocksData.push({ start: startVal, end: endVal });
        });

        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(blocksData));
            alert('保存しました。');
        } catch (e) {
            console.error('LocalStorageへの保存に失敗しました:', e);
            alert('保存に失敗しました。');
        }
    });

    // コピー出力 (変更)
    copyBtn.addEventListener('click', () => {
        let output = '';
        // #cp .funcbody 内の .block のみを取得
        const blocks = funcBody.querySelectorAll('.block');

        if (blocks.length === 0) {
            alert('コピーするブロックがありません。');
            return;
        }

        try {
            blocks.forEach((block, index) => {
                const startTag = block.querySelector('.selector-start').value;
                const endTag = block.querySelector('.selector-end').value;
                const contentValue = block.querySelector('.content').value;

                // 変更: startTag + content + endTag で結合
                // (片方だけでも入力されていれば結合されます)
                if (startTag || endTag || contentValue) {
                     output += startTag + contentValue + endTag;
                }
            });

            // クリップボードにコピー
            navigator.clipboard.writeText(output).then(() => {
                alert('クリップボードにコピーしました！');
            }).catch(err => {
                console.error('コピーに失敗しました:', err);
                alert('クリップボードへのコピーに失敗しました。');
            });

        } catch (e) {
            alert(`エラーが発生しました: ${e.message}`);
        }
    });

    // --- 初期化処理 ---

    /**
     * ページ読み込み時にLocalStorageからデータを復元する
     */
    function loadFromStorage() { // (変更)
        try {
            const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedData) {
                const blocksData = JSON.parse(savedData); // selectors -> blocksData
                if (Array.isArray(blocksData)) {
                    // 既存のブロックをクリア
                    blocksContainer.innerHTML = '';
                    // 保存されたセレクタでブロックを復元
                    blocksData.forEach(block => {
                        // 変更: createBlockの引数を変更
                        if (block && typeof block.start !== 'undefined' && typeof block.end !== 'undefined') {
                            createBlock(block.start, block.end);
                        }
                    });
                }
            }
        } catch (e) {
            console.error('LocalStorageからの復元に失敗しました:', e);
            // 復元に失敗してもlocalStorageをクリアしない (指示)
        }
    }

    // 起動時にデータを読み込む
    loadFromStorage();

});
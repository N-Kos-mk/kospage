// v2 - 機能実装

// セレクタが長くなるため、ヘルパー関数を定義
function $(selector) {
    return document.querySelector("#image").querySelector(`.funcbody ${selector}`);
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const imageIdInput = $('#image-id');
    const pasteWrapper = $('#paste-area-wrapper');
    const pasteCanvas = $('#paste-canvas');
    const bgColorInput = $('#bg-color-input');
    const bgColorApplyBtn = $('#bg-color-apply');
    
    const trimCanvas = $('#trim-canvas');
    const centerVBtn = $('#center-v');
    const centerHBtn = $('#center-h');
    
    const thumbnailCanvas = $('#thumbnail-canvas');
    const downloadBtn1 = $('#download-1');
    const downloadBtn2 = $('#download-2');
    const downloadBtn3 = $('#download-3');
    const downloadBtn4 = $('#download-4');
    const downloadBtn7 = $('#download-7');

    // Canvas Context
    const pasteCtx = pasteCanvas.getContext('2d');
    const trimCtx = trimCanvas.getContext('2d');
    const thumbnailCtx = thumbnailCanvas.getContext('2d');

    // 状態管理変数
    let originalImage = null; // 元画像のImageオブジェクト
    let backgroundColor = '#000000';

    // トリミング状態 (v5変更: Canvas描画領域に対する割合で保持)
    let trimState = {
        scale: 1.0,  // 拡大率 (1.0がContainフィット)
        offsetX: 0, // Canvas描画領域の中心からのX軸オフセット割合 (-0.5から0.5の範囲)
        offsetY: 0, // Canvas描画領域の中心からのY軸オフセット割合 (-0.5から0.5の範囲)
    };
    

    // ドラッグ操作
    let isDragging = false;
    let dragStart = { x: 0, y: 0, ox: 0, oy: 0 };

    // 定数
    const TRIM_SIZE = 500;
    const THUMBNAIL_SIZE = 500;
    const DOWNLOAD_TRIM_SIZE = 1200;
    const DOWNLOAD_THUMBNAIL_SIZE = 230;
    const LOCAL_STORAGE_KEY = 'imageToolBgColor_v1';

    // --- 初期化 ---

    function initialize() {
        // paste-canvasの解像度を親要素に合わせる
        pasteCanvas.width = pasteWrapper.clientWidth;
        pasteCanvas.height = pasteWrapper.clientHeight;
        
        loadBackgroundColor();
        setupEventListeners();
        redrawAll(); // 初期背景色を描画
    }

    // --- イベントリスナー設定 ---

    function setupEventListeners() {
        // 1. 色変更
        bgColorApplyBtn.addEventListener('click', applyColor);

        // 2. 左枠の選択
        pasteWrapper.addEventListener('click', () => {
            pasteWrapper.classList.add('selected');
        });
        
        // ページ全体で選択解除（簡易）
        document.addEventListener('click', (e) => {
            if (!pasteWrapper.contains(e.target)) {
                pasteWrapper.classList.remove('selected');
            }
        });

        // 3. ペースト
        document.addEventListener('paste', handlePaste);

        // 4. トリミング操作 (ホイール)
        trimCanvas.addEventListener('wheel', handleWheel, { passive: false });
        
        // 5. トリミング操作 (ドラッグ)
        trimCanvas.addEventListener('mousedown', handleMouseDown);
        trimCanvas.addEventListener('mousemove', handleMouseMove);
        trimCanvas.addEventListener('mouseup', handleMouseUp);
        trimCanvas.addEventListener('mouseleave', handleMouseUp); // 枠外でもドラッグ終了

        // 6. 中央揃え
        centerVBtn.addEventListener('click', () => centerImage(false, true));
        centerHBtn.addEventListener('click', () => centerImage(true, false));
        
        // 7. ダウンロード
        downloadBtn1.addEventListener('click', () => handleDownload(1));
        downloadBtn2.addEventListener('click', () => handleDownload(2));
        downloadBtn3.addEventListener('click', () => handleDownload(3));
        downloadBtn4.addEventListener('click', () => handleDownload(4));
        downloadBtn7.addEventListener('click', () => handleDownload(7));
    }

    // --- 色処理 ---

    function loadBackgroundColor() {
        const savedColor = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedColor) {
            backgroundColor = savedColor;
            bgColorInput.value = savedColor;
        }
    }

    function applyColor() {
        backgroundColor = bgColorInput.value;
        localStorage.setItem(LOCAL_STORAGE_KEY, backgroundColor);
        redrawAll();
    }

    // --- 画像ペースト処理 ---

    function handlePaste(e) {
        // 左枠が選択されていなければ何もしない
        if (!pasteWrapper.classList.contains('selected')) {
            // console.log('Paste ignored: Wrapper not selected.');
            return;
        }
        
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let file = null;

        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                file = item.getAsFile();
                break;
            }
        }

        if (!file) return;

        // 画像読み込み
        const reader = new FileReader();
        reader.onload = (event) => {
            originalImage = new Image();
            originalImage.onload = () => {
                // 画像読み込み完了
                resetTrimState();
                redrawAll();
            };
            originalImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // --- トリミング状態リセット ---

    function resetTrimState() {
        // scale 1.0 = contain fit (v3変更)
        trimState.scale = 1.0; 
        // offset 0 = 中央 (v3変更: オフセットはCanvas座標系)
        trimState.offsetX = 0;
        trimState.offsetY = 0;
        
        // v2のbaseScale計算は不要になった
    }

    // --- 全Canvas再描画 ---

    function redrawAll() {
        drawPasteCanvas();
        drawTrimAndThumbnail();
    }
    
    function drawTrimAndThumbnail() {
        // 状態が同じならトリミングとサムネイルは連動する
        drawCanvas(trimCtx, TRIM_SIZE, TRIM_SIZE, trimState);
        drawCanvas(thumbnailCtx, THUMBNAIL_SIZE, THUMBNAIL_SIZE, trimState);
    }

    // --- Canvas描画 (左枠: Contain) ---

    function drawPasteCanvas() {
        const canvas = pasteCanvas;
        const ctx = pasteCtx;
        const cw = canvas.width;
        const ch = canvas.height;

        // 1. 背景色で塗りつぶし
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, cw, ch);

        if (!originalImage) return;

        // 2. アスペクト比維持 (Contain)
        const imgRatio = originalImage.height / originalImage.width;
        const canvasRatio = ch / cw;
        
        let dWidth, dHeight, dx, dy;

        if (imgRatio > canvasRatio) { // 画像が縦長
            dHeight = ch;
            dWidth = dHeight / imgRatio;
            dy = 0;
            dx = (cw - dWidth) / 2;
        } else { // 画像が横長
            dWidth = cw;
            dHeight = dWidth * imgRatio;
            dx = 0;
            dy = (ch - dHeight) / 2;
        }
        
        ctx.drawImage(originalImage, 0, 0, originalImage.width, originalImage.height, dx, dy, dWidth, dHeight);
    }

    // --- Canvas描画 (右枠: Cover / トリミング) ---
    // (トリミング、サムネイル、ダウンロードで共用)

    /**
 * 指定されたCanvasに、現在のtrimStateに基づいて画像を描画する (Contain + Zoom/Pan)
 * @param {CanvasRenderingContext2D} ctx 描画対象のContext
 * @param {number} outputWidth 出力先の幅 (px)
 * @param {number} outputHeight 出力先の高さ (px)
 * @param {object} state 使用するトリミング状態
 */
function drawCanvas(ctx, outputWidth, outputHeight, state) {
    const canvas = ctx.canvas;
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, outputWidth, outputHeight);

    if (!originalImage) return;

    const iw = originalImage.width;
    const ih = originalImage.height;
    const imgRatio = ih / iw;
    const canvasRatio = outputHeight / outputWidth;
    

    // 2. 基準となる「Contain」フィットの計算 (これが scale = 1.0)
    let baseWidth, baseHeight;
    if (imgRatio > canvasRatio) { // 画像が縦長 (Canvas基準)
        baseHeight = outputHeight;
        baseWidth = baseHeight / imgRatio;
    } else { // 画像が横長 (Canvas基準)
        baseWidth = outputWidth;
        baseHeight = baseWidth * imgRatio;
    }

    // 3. スケール(Zoom)を適用
    const dWidth = baseWidth * state.scale;
    const dHeight = baseHeight * state.scale;

    // 4. オフセット(Drag)を適用
    // 基準位置 (中央)
    const initialDx = (outputWidth - dWidth) / 2;
    const initialDy = (outputHeight - dHeight) / 2;
    
    // オフセット適用 (v5変更: trimState.offsetX/Y は割合なので、outputWidth/Heightを掛ける)
    const dx = initialDx + (state.offsetX * outputWidth);
    const dy = initialDy + (state.offsetY * outputHeight);
    
    // 5. Canvasに描画
    ctx.drawImage(originalImage, 0, 0, iw, ih, dx, dy, dWidth, dHeight);
}


    // --- トリミング操作ハンドラ ---

    function handleWheel(e) {
        if (!originalImage) return;
        e.preventDefault(); // ページのスクロールを無効化

        const delta = e.deltaY;
        const zoomIntensity = 0.01;
        
        let newScale = trimState.scale + (delta * zoomIntensity * -1);

        // スケールは 0.1 以上に制限 (v3変更)
        if (newScale < 0.1) {
            newScale = 0.1;
        }
        
        trimState.scale = newScale;
        
        // v2のオフセット制限はロジック変更により削除
        // restrictOffsets(); 
        drawTrimAndThumbnail();
    }

    function handleMouseDown(e) {
        if (!originalImage) return;
        isDragging = true;
        
        // ドラッグ開始時のCanvas座標と、その時点のオフセットを保存
        dragStart.x = e.offsetX;
        dragStart.y = e.offsetY;
        dragStart.ox = trimState.offsetX;
        dragStart.oy = trimState.offsetY;
        
        trimCanvas.style.cursor = 'grabbing';
    }

    function handleMouseMove(e) {
    if (!isDragging || !originalImage) return;
    e.preventDefault(); // ドラッグ中の画像選択などを無効化

    // Canvas上でのピクセル移動量
    const deltaX_px = e.offsetX - dragStart.x;
    const deltaY_px = e.offsetY - dragStart.y;

    // v5変更: ピクセル移動量をトリミング枠の幅・高さで割って割合に変換
    // dragStart.ox, oy はすでに割合で保持されている
    trimState.offsetX = dragStart.ox + (deltaX_px / TRIM_SIZE);
    trimState.offsetY = dragStart.oy + (deltaY_px / TRIM_SIZE);
    
    drawTrimAndThumbnail();
}

    function handleMouseUp() {
        isDragging = false;
        trimCanvas.style.cursor = 'grab';
    }

    // --- 中央揃え・オフセット制限 ---

    function centerImage(horizontal, vertical) {
        if (!originalImage) return;
        
        if (horizontal) {
            trimState.offsetX = 0;
        }
        if (vertical) {
            trimState.offsetY = 0;
        }
        drawTrimAndThumbnail();
    }
    /*
    // オフセットがはみ出しすぎないように制限
    function restrictOffsets() {
        if (!originalImage) return;

        const { sWidth, sHeight } = getSourceDimensions(TRIM_SIZE, TRIM_SIZE, trimState);
        const iw = originalImage.width;
        const ih = originalImage.height;

        // (sx, sy) の基本位置
        const { baseSx, baseSy } = getBaseSourcePosition(TRIM_SIZE, TRIM_SIZE);

        // 最大/最小のオフセットを計算
        // (sx + offsetX) が 0 以上 (iw - sWidth) 以下になるように
        const maxOffsetX = (iw - sWidth) - baseSx;
        const minOffsetX = -baseSx;
        
        const maxOffsetY = (ih - sHeight) - baseSy;
        const minOffsetY = -baseSy;

        if (trimState.offsetX < minOffsetX) trimState.offsetX = minOffsetX;
        if (trimState.offsetX > maxOffsetX) trimState.offsetX = maxOffsetX;
        if (trimState.offsetY < minOffsetY) trimState.offsetY = minOffsetY;
        if (trimState.offsetY > maxOffsetY) trimState.offsetY = maxOffsetY;
    }

    // --- 計算ヘルパー (drawCanvasとロジックを共通化) ---

    // 基準となる(Scale=1.0)切り出しサイズ
    function getBaseSourceDimensions(outputWidth, outputHeight) {
        const iw = originalImage.width;
        const ih = originalImage.height;
        const imgRatio = ih / iw;
        const canvasRatio = outputHeight / outputWidth;

        let sWidth, sHeight;
        if (imgRatio > canvasRatio) { // 縦長
            sWidth = iw;
            sHeight = iw * canvasRatio;
        } else { // 横長
            sHeight = ih;
            sWidth = ih / canvasRatio;
        }
        return { sWidth, sHeight };
    }
    
    // 基準となる(Scale=1.0, Offset=0)切り出し開始位置
    function getBaseSourcePosition(outputWidth, outputHeight) {
        const { sWidth, sHeight } = getBaseSourceDimensions(outputWidth, outputHeight);
        const iw = originalImage.width;
        const ih = originalImage.height;

        const baseSx = (iw - sWidth) / 2;
        const baseSy = (ih - sHeight) / 2;
        return { baseSx, baseSy };
    }

    // スケール適用後の切り出しサイズ
    function getSourceDimensions(outputWidth, outputHeight, state) {
        const { sWidth, sHeight } = getBaseSourceDimensions(outputWidth, outputHeight);
        return {
            sWidth: sWidth / state.scale,
            sHeight: sHeight / state.scale
        };
    }*/


    // --- ダウンロード処理 ---

    function handleDownload(number) {
        const id = imageIdInput.value.trim();
        if (!id) {
            alert('IDを入力してください。');
            return;
        }

        if (!originalImage) {
            alert('画像を貼り付けてください。');
            return;
        }
        // オフスクリーンCanvasを作成
        const downloadCanvasTrim = document.createElement('canvas');
        const trimCtxDown = downloadCanvasTrim.getContext('2d');
        
        // ダウンロード
        if (number == 1) {
            drawCanvas(trimCtxDown, DOWNLOAD_THUMBNAIL_SIZE, DOWNLOAD_THUMBNAIL_SIZE, trimState);
            downloadImage(downloadCanvasTrim, `${id}_1.jpg`);
        } else {
            drawCanvas(trimCtxDown, DOWNLOAD_TRIM_SIZE, DOWNLOAD_TRIM_SIZE, trimState);
            downloadImage(downloadCanvasTrim, `${id}_${number}.jpg`);
        }
        

        
        /*/ 2. サムネイル (230x230)
        const downloadCanvasThumb = document.createElement('canvas');
        const thumbCtxDown = downloadCanvasThumb.getContext('2d');
        
        // drawCanvasをダウンロードサイズで実行
        drawCanvas(thumbCtxDown, DOWNLOAD_THUMBNAIL_SIZE, DOWNLOAD_THUMBNAIL_SIZE, trimState);
        
        // ダウンロード
        downloadImage(downloadCanvasThumb, `${id}_3.jpg`);*/
    }

    function downloadImage(canvas, filename) {
        const a = document.createElement('a');
        // JPEG形式でダウンロード
        a.href = canvas.toDataURL('image/jpeg', 0.9); // 品質 0.9
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    


    // --- 実行 ---
    initialize();

});


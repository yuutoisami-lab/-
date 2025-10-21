// シーン (Scene) の作成: オブジェクトや光の入れ物
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcccccc); // 背景色を設定

// カメラ (Camera) の作成: 視点
const camera = new THREE.PerspectiveCamera(
    75, // 視野角
    window.innerWidth / window.innerHeight, // アスペクト比
    0.1, // near (手前のクリッピング距離)
    1000 // far (奥のクリッピング距離)
);
camera.position.set(0, 2, 5); // カメラを配置 (X, Y, Z)

// レンダラー (Renderer) の作成: 描画担当
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight); // 描画サイズを設定
document.body.appendChild(renderer.domElement); // HTMLにキャンバスを追加
// 環境光 (AmbientLight): シーン全体を均等に照らす
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 色と強度
scene.add(ambientLight);

// 平行光源 (DirectionalLight): 太陽のような一方向からの光
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7); // 光源の位置
scene.add(directionalLight);
const loader = new THREE.ObjectLoader();

// JSONファイルのパスを指定
const jsonFilePath = './model.json'; 

loader.load(
    jsonFilePath,
    function (object) {
        // 読み込まれたモデルをシーンに追加
        scene.add(object);
        
        // オブジェクトの初期設定（例: モデルを少し回転させる）
        // object.rotation.y = Math.PI / 4; 
    },
    // 読み込み進捗 (省略可能)
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100).toFixed(2) + '% loaded');
    },
    // エラー処理 (省略可能)
    function (error) {
        console.error('JSONモデルの読み込みエラー:', error);
    }
);
function animate() {
    // ブラウザの次の描画タイミングで animate 関数を再度呼び出す
    requestAnimationFrame(animate);

    // *************
    // オブジェクトの更新処理をここに書く
    // 例: カメラを少し回転させるなど
    // camera.position.x += 0.005;
    // *************

    // シーンをカメラを通してレンダリング
    renderer.render(scene, camera);
}

// 描画ループを開始
animate();
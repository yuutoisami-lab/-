// index.htmlで既に初期化された 'db' (Firestoreインスタンス) を使用します。

const candidatesList = document.getElementById('candidates');
const candidateSelect = document.getElementById('candidate-select');

// --- データベースからのリアルタイム監視（必須） ---
// Firestoreの'candidates'コレクションを監視し、変更があれば自動で画面を更新します
db.collection("candidates").onSnapshot((snapshot) => {
    // リストとセレクトボックスをクリア
    candidatesList.innerHTML = '';
    candidateSelect.innerHTML = '';
    
    const candidates = [];
    
    snapshot.forEach((doc) => {
        candidates.push({ id: doc.id, ...doc.data() });
    });

    // ステータスに基づいてリストをソート（指名済みを一番上に）
    candidates.sort((a, b) => {
        if (a.status === 'drafted' && b.status !== 'drafted') return -1;
        if (a.status !== 'drafted' && b.status === 'drafted') return 1;
        return 0; // その他の場合は順序維持
    });

    // 候補者リスト (ul/li) の生成
    candidates.forEach(candidate => {
        // リストアイテムの生成
        const li = document.createElement('li');
        li.setAttribute('data-status', candidate.status);
        li.textContent = `👤 ${candidate.name} (${candidate.status === 'drafted' ? '指名済み' : '未指名'})`;
        candidatesList.appendChild(li);

        // 指名用ドロップダウンメニューの生成 (未指名のみ)
        if (candidate.status !== 'drafted') {
            const option = document.createElement('option');
            option.value = candidate.id;
            option.textContent = candidate.name;
            candidateSelect.appendChild(option);
        }
    });
});

// --- 指名アクションの関数（データ更新） ---
function draftCandidate() {
    const selectedId = candidateSelect.value;
    if (!selectedId) {
        alert('指名する候補者を選択してください。');
        return;
    }

    // 選択された候補者のドキュメントを参照
    const candidateRef = db.collection("candidates").doc(selectedId);

    // データベースを更新
    candidateRef.update({
        status: 'drafted',
        draftedAt: firebase.firestore.FieldValue.serverTimestamp() // 指名時刻を記録
    })
    .then(() => {
        console.log("指名が成功しました: " + selectedId);
        alert(`${candidateSelect.options[candidateSelect.selectedIndex].text}を指名しました！`);
        // 画面はonSnapshotが自動で更新してくれるため、手動でのDOM操作は不要です
    })
    .catch((error) => {
        console.error("指名エラー: ", error);
        alert("指名に失敗しました。コンソールを確認してください。");
    });
}


// --- データベースの初期データ構造 (一度だけ実行) ---
/*
    // Firestoreコンソールで以下のような構造でコレクションを作成してください。
    // コレクション名: 'candidates'
    // ドキュメントID (自動生成)
    //   - name: "候補者 A" (string)
    //   - status: "un-drafted" (string)
    //
    // 複数の候補者ドキュメントを作成します。
*/
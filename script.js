// index.htmlで既に初期化された 'db' (Firestoreインスタンス) を使用します。

const candidatesList = document.getElementById('candidates');
const candidateSelect = document.getElementById('candidate-select');
const rankSelectionScreen = document.getElementById('rank-selection');
const draftListScreen = document.getElementById('draft-list-screen');
const currentRankTitle = document.getElementById('current-rank-title');

// 選択された現在のドラフト順位を保持する変数
let selectedDraftRank = null; 

// --- 画面遷移ロジック ---

// 順位選択画面を表示する
function showRankSelection() {
    draftListScreen.style.display = 'none';
    rankSelectionScreen.style.display = 'block';
    selectedDraftRank = null;
}

// 順位を選択し、選手一覧画面へ遷移する
function selectRank(rank) {
    selectedDraftRank = rank;
    currentRankTitle.textContent = `ドラフト ${rank} 位の指名候補者`;
    
    // 画面を切り替え
    rankSelectionScreen.style.display = 'none';
    draftListScreen.style.display = 'block';

    // 必要であれば、ここで指名状況の確認や特殊な処理を追加できます
    console.log(`ドラフト ${rank} 位が選択されました。`);
}


// --- データベースからのリアルタイム監視 (既存コードを維持) ---
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
        // statusがdraftedで、draftedAtがあれば、さらに新しいものを上にソートするロジックも追加可能
        return 0;
    });

    // 候補者リスト (ul/li) の生成
    candidates.forEach(candidate => {
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
    
    if (!selectedDraftRank) {
        alert('先に指名順位を選択してください。');
        return;
    }
    
    if (!selectedId) {
        alert('指名する候補者を選択してください。');
        return;
    }

    // 選択された候補者のドキュメントを参照
    const candidateRef = db.collection("candidates").doc(selectedId);

    // データベースを更新 (指名順位をFirestoreに記録するように変更)
    candidateRef.update({
        status: 'drafted',
        drafted_rank: selectedDraftRank, // 選択した順位を記録
        draftedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log(`ドラフト ${selectedDraftRank} 位の指名が成功しました。`);
        alert(`ドラフト ${selectedDraftRank} 位として、${candidateSelect.options[candidateSelect.selectedIndex].text}を指名しました！`);
        
        // 指名後、順位選択画面に戻る
        showRankSelection();
    })
    .catch((error) => {
        console.error("指名エラー: ", error);
        alert("指名に失敗しました。");
    });
}

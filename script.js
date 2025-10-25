// index.htmlで既に初期化された 'db' (Firestoreインスタンス) を使用します。

// --- 新しい変数と要素の取得 ---
const candidatesList = document.getElementById('candidates');
const candidateSelect = document.getElementById('candidate-select');
const teamSelectionScreen = document.getElementById('team-selection');
const rankSelectionScreen = document.getElementById('rank-selection');
const draftListScreen = document.getElementById('draft-list-screen');
const currentRankTitle = document.getElementById('current-rank-title');
const rankStatusMessage = document.getElementById('rank-status-message'); // 新しい要素を取得

// 選択されたドラフト順位と参加チーム数
let selectedDraftRank = null; 
let totalTeamCount = null;
// 🚨 システムが要求する現在の指名順位
let currentSystemRank = 1; 

// --- Firestoreから現在のシステムランクを取得するリスナー ---
db.collection("metadata").doc("draft_state").onSnapshot(doc => {
    if (doc.exists) {
        currentSystemRank = doc.data().current_rank || 1;
    } else {
        // ドキュメントが存在しない場合、初期値として1位を設定
        db.collection("metadata").doc("draft_state").set({ current_rank: 1 });
        currentSystemRank = 1;
    }
    
    // ランク選択画面が表示されている場合、ボタンの状態を更新
    if (rankSelectionScreen.style.display === 'block') {
        updateRankSelectionUI();
    }
});

// --- 順位選択UIを更新する関数 ---
function updateRankSelectionUI() {
    const rankButtons = document.querySelectorAll('#draft-ranks .rank-btn');

    rankButtons.forEach(btn => {
        // ボタンのテキストから順位を取得
        const rank = parseInt(btn.textContent.match(/\d+/)[0]);

        if (rank === currentSystemRank && currentSystemRank <= 7) {
            // 現在の順位であれば有効化
            btn.disabled = false;
            btn.style.opacity = 1.0;
            btn.style.backgroundColor = '#007bff';
            btn.textContent = `▶️ ドラフト ${rank} 位を指名`;
        } else {
            // それ以外の順位は無効化
            btn.disabled = true;
            btn.style.opacity = 0.5;
            btn.style.backgroundColor = '#6c757d';
            btn.textContent = `ドラフト ${rank} 位 (待機中)`;
        }
    });

    if (rankStatusMessage) {
        if (currentSystemRank <= 7) {
            rankStatusMessage.textContent = `🔥 次に指名すべき順位: ドラフト ${currentSystemRank} 位`;
            rankStatusMessage.style.backgroundColor = '#d4edda'; 
            rankStatusMessage.style.color = '#155724';
        } else {
            rankStatusMessage.textContent = `✅ ドラフトは終了しました。最終順位: 7 位`;
            rankStatusMessage.style.backgroundColor = '#fff3cd';
            rankStatusMessage.style.color = '#856404';
            rankButtons.forEach(btn => btn.disabled = true);
        }
    }
}


// --- 画面遷移ロジック ---

// 参加チーム設定画面を表示する
function showTeamSelection() {
    draftListScreen.style.display = 'none';
    rankSelectionScreen.style.display = 'none';
    teamSelectionScreen.style.display = 'block';
    selectedDraftRank = null;
}

// 順位選択画面を表示する
function showRankSelection() {
    draftListScreen.style.display = 'none';
    rankSelectionScreen.style.display = 'block';
    teamSelectionScreen.style.display = 'none';
    selectedDraftRank = null;
    
    // 順位選択UIを現在のシステムランクに基づいて更新
    updateRankSelectionUI(); 
}

// チーム数を設定し、順位選択画面へ遷移する
function setTeamCount(count) {
    totalTeamCount = count;
    alert(`${count}チームでドラフトを開始します。`);
    showRankSelection(); 
}


// 順位を選択し、選手一覧画面へ遷移する（選択順序のチェックは指名時に行う）
function selectRank(rank) {
    // 🚨 選択順序の強制チェック
    if (rank !== currentSystemRank) {
        alert(`現在はドラフト ${currentSystemRank} 位の指名順です。`);
        return;
    }
    
    selectedDraftRank = rank;
    currentRankTitle.textContent = `ドラフト ${rank} 位の指名候補者`;
    
    rankSelectionScreen.style.display = 'none';
    draftListScreen.style.display = 'block';

    console.log(`ドラフト ${rank} 位が選択されました。`);
}


// --- データベースからのリアルタイム監視（候補者リスト） ---
db.collection("candidates").onSnapshot((snapshot) => {
    candidatesList.innerHTML = '';
    candidateSelect.innerHTML = '';
    
    const candidates = [];
    
    snapshot.forEach((doc) => {
        candidates.push({ id: doc.id, ...doc.data() });
    });

    // 候補者リスト (ul/li) の生成
    candidates.forEach(candidate => {
        const li = document.createElement('li');
        
        const draftCount = candidate.drafted_by ? candidate.drafted_by.length : 0;
        
        // --- 表示テキストの調整 ---
        let statusText = '👤 未指名';
        if (draftCount > 0) {
            statusText = `✅ ${draftCount} チームが指名済み`;
            li.setAttribute('data-status', 'drafted'); 
        } else {
            li.setAttribute('data-status', 'un-drafted');
        }

        li.textContent = `${candidate.name} (${statusText})`;
        
        if (draftCount > 0) {
            const teamList = candidate.drafted_by.map(team => `チーム ${team}`).join(', ');
            li.textContent += ` [指名元: ${teamList}]`;
        }

        candidatesList.appendChild(li);

        // --- プルダウンへの追加ロジック ---
        // totalTeamCountが設定されていればその値でチェック、そうでなければ指名ゼロ（未指名）のみ表示
        if (draftCount < (totalTeamCount || 1)) {
            const option = document.createElement('option');
            option.value = candidate.id;
            option.textContent = `${candidate.name} (${draftCount} チーム指名)`;
            candidateSelect.appendChild(option);
        }
    });
});


// --- 指名アクションの関数（順序チェックと状態更新） ---
function draftCandidate() {
    const selectedId = candidateSelect.value;
    
    if (!totalTeamCount) {
        alert('先にドラフト参加チーム数を設定してください。');
        showTeamSelection();
        return;
    }
    if (selectedDraftRank !== currentSystemRank) {
        alert(`指名順が正しくありません。現在はドラフト ${currentSystemRank} 位の指名順です。`);
        showRankSelection();
        return;
    }
    if (!selectedId) {
        alert('指名する候補者を選択してください。');
        return;
    }

    const candidateRef = db.collection("candidates").doc(selectedId);
    
    let teamNumberInput = prompt(`指名を行うのは何番目のチームですか？ (1から${totalTeamCount}の数字を入力)`);
    
    if (teamNumberInput === null) { return; }
    
    let teamNumber = parseInt(teamNumberInput.trim()); 

    if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > totalTeamCount) {
        alert(`無効なチーム番号です。1から${totalTeamCount}の数字を入力してください。`);
        return;
    }

    // 重複を記録するために、Firestoreの配列操作 (arrayUnion) を使用
    candidateRef.update({
        draft_info: firebase.firestore.FieldValue.arrayUnion({
            team: teamNumber,
            rank: selectedDraftRank,
            timestamp: new Date()
        }),
        drafted_by: firebase.firestore.FieldValue.arrayUnion(teamNumber) 
    })
    .then(() => {
        // 成功したら次のランクに進める (7位までを強制)
        if (currentSystemRank < 7) { 
            return db.collection("metadata").doc("draft_state").update({
                current_rank: currentSystemRank + 1
            });
        }
        return Promise.resolve(); // 7位で終了
    })
    .then(() => {
        alert(`チーム ${teamNumber} がドラフト ${selectedDraftRank} 位として指名しました！`);
        showRankSelection(); 
    })
    .catch((error) => {
        console.error("指名エラー: ", error);
        alert("指名に失敗しました。コンソールを確認してください。");
    });
}


// --- リセット関数（状態管理のリセットも含む） ---
function resetDraft() {
    if (!confirm("本当にドラフト全体をリセットし、全候補者を未指名に戻しますか？")) {
        return;
    }
    
    const batch = db.batch();
    
    // 全候補者を取得
    db.collection("candidates").get().then((snapshot) => {
        snapshot.forEach((doc) => {
            batch.update(doc.ref, { 
                status: firebase.firestore.FieldValue.delete(),
                drafted_rank: firebase.firestore.FieldValue.delete(), 
                draftedAt: firebase.firestore.FieldValue.delete(),
                drafted_by: firebase.firestore.FieldValue.delete(),
                draft_info: firebase.firestore.FieldValue.delete()
            });
        });

        // 1. 候補者の指名情報をリセット
        batch.commit()
        .then(() => {
            // 2. システムの状態を1位にリセット
            return db.collection("metadata").doc("draft_state").update({ current_rank: 1 });
        })
        .then(() => {
            alert("✅ ドラフトはリセットされ、全候補者が未指名になりました。");
            showRankSelection();
        })
        .catch((error) => {
            console.error("リセットエラー:", error);
            alert("リセット中にエラーが発生しました。コンソールを確認してください。");
        });
    });
}

// ページロード時に必ずチーム選択画面を表示する
window.onload = function() {
    showTeamSelection();
};

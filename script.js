// index.htmlで既に初期化された 'db' (Firestoreインスタンス) を使用します。

// --- 変数と要素の取得 ---
const candidatesList = document.getElementById('candidates');
const candidateSelect = document.getElementById('candidate-select');
const teamSelectionScreen = document.getElementById('team-selection');
const rankSelectionScreen = document.getElementById('rank-selection');
const draftListScreen = document.getElementById('draft-list-screen');
const currentRankTitle = document.getElementById('current-rank-title');
const rankStatusMessage = document.getElementById('rank-status-message');
const draftActionButton = document.getElementById('draft-action-button'); // 指名ボタンのIDが必要になるため、index.htmlにIDを追加してください

// 選択されたドラフト順位と参加チーム数
let selectedDraftRank = null; 
let totalTeamCount = null;
// システムが要求する現在の指名順位と仮指名の状態
let currentSystemRank = 1; 
let temporaryDrafts = {}; // { teamNumber: candidateId, ... } 形式で仮指名情報を保持

// --- Firestoreからのリアルタイム監視（メタデータと候補者リスト） ---

// 1. メタデータ（現在の順位と仮指名情報）の監視
db.collection("metadata").doc("draft_state").onSnapshot(doc => {
    if (doc.exists) {
        currentSystemRank = doc.data().current_rank || 1;
        temporaryDrafts = doc.data().temporary_drafts || {};
    } else {
        // ドキュメントが存在しない場合、初期値として1位を設定
        db.collection("metadata").doc("draft_state").set({ current_rank: 1, temporary_drafts: {} });
        currentSystemRank = 1;
        temporaryDrafts = {};
    }
    
    // UI更新処理を実行
    if (rankSelectionScreen.style.display === 'block') {
        updateRankSelectionUI();
    }
    if (draftListScreen.style.display === 'block') {
        updateDraftActionUI();
    }
});

// 2. 候補者リストの監視
db.collection("candidates").onSnapshot((snapshot) => {
    candidatesList.innerHTML = '';
    candidateSelect.innerHTML = '';
    
    const candidates = [];
    snapshot.forEach((doc) => {
        candidates.push({ id: doc.id, ...doc.data() });
    });

    candidates.forEach(candidate => {
        const li = document.createElement('li');
        const draftCount = candidate.drafted_by ? candidate.drafted_by.length : 0;
        
        // --- 表示テキストの調整 ---
        let statusText = '👤 未指名';
        li.setAttribute('data-status', 'un-drafted');
        
        if (draftCount > 0) {
            statusText = `✅ ${draftCount} チームが指名済み`;
            li.setAttribute('data-status', 'drafted'); 
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

// --- UI更新関数 ---

// 順位選択UIを更新する関数
function updateRankSelectionUI() {
    const rankButtons = document.querySelectorAll('#draft-ranks .rank-btn');

    rankButtons.forEach(btn => {
        const rank = parseInt(btn.textContent.match(/\d+/)[0]);
        if (rank === currentSystemRank && currentSystemRank <= 7) {
            btn.disabled = false;
            btn.style.opacity = 1.0;
            btn.style.backgroundColor = '#007bff';
            btn.textContent = `▶️ ドラフト ${rank} 位を指名`;
        } else {
            btn.disabled = true;
            btn.style.opacity = 0.5;
            btn.style.backgroundColor = '#6c757d';
            btn.textContent = `ドラフト ${rank} 位 (待機中)`;
        }
    });

    if (rankStatusMessage) {
        if (currentSystemRank <= 7) {
            // 現在の仮指名数を取得
            const completedTeams = Object.keys(temporaryDrafts).length;
            const remainingTeams = (totalTeamCount || 0) - completedTeams;

            rankStatusMessage.textContent = 
                `🔥 ${currentSystemRank} 位指名中！ (残り ${remainingTeams} チーム)`;
            rankStatusMessage.style.backgroundColor = remainingTeams === 0 ? '#ffc107' : '#d4edda'; // 全員完了したら警告色に
            rankStatusMessage.style.color = remainingTeams === 0 ? '#856404' : '#155724';
        } else {
            rankStatusMessage.textContent = `✅ ドラフトは終了しました。最終順位: 7 位`;
            rankStatusMessage.style.backgroundColor = '#fff3cd';
            rankStatusMessage.style.color = '#856404';
            rankButtons.forEach(btn => btn.disabled = true);
        }
    }
}

// 指名アクションUIを更新する関数 (指名済みかどうか)
function updateDraftActionUI() {
    // ユーザー自身のチーム番号を取得するか、入力済みであればそれを表示するロジックが必要
    // 今回は簡易化のため、毎回チーム番号を尋ねるプロンプトをそのまま使用します。

    // 仮指名が完了しているかどうかの確認
    // 💡 注意: この確認は、現在のセッションで入力したチーム番号と temporaryDrafts を照合して行う必要がありますが、
    // チーム番号をグローバルに保持するロジックがないため、常に有効な状態を維持します。
    // 代わりに、指名成功時に「指名完了」アラートを出すことでユーザーに伝えます。
}

// --- 画面遷移ロジック ---

function showTeamSelection() {
    draftListScreen.style.display = 'none';
    rankSelectionScreen.style.display = 'none';
    teamSelectionScreen.style.display = 'block';
    selectedDraftRank = null;
}

function showRankSelection() {
    draftListScreen.style.display = 'none';
    rankSelectionScreen.style.display = 'block';
    teamSelectionScreen.style.display = 'none';
    selectedDraftRank = null;
    updateRankSelectionUI(); 
}

function setTeamCount(count) {
    totalTeamCount = count;
    alert(`${count}チームでドラフトを開始します。`);
    showRankSelection(); 
}

function selectRank(rank) {
    if (rank !== currentSystemRank) {
        alert(`現在はドラフト ${currentSystemRank} 位の指名順です。`);
        return;
    }
    
    selectedDraftRank = rank;
    currentRankTitle.textContent = `ドラフト ${rank} 位の指名候補者`;
    
    rankSelectionScreen.style.display = 'none';
    draftListScreen.style.display = 'block';
    updateDraftActionUI();
}


// --- 指名アクションの関数（仮指名と一括確定） ---
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

    let teamNumberInput = prompt(`指名を行うのは何番目のチームですか？ (1から${totalTeamCount}の数字を入力)`);
    if (teamNumberInput === null) { return; }
    let teamNumber = parseInt(teamNumberInput.trim()); 

    if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > totalTeamCount) {
        alert(`無効なチーム番号です。1から${totalTeamCount}の数字を入力してください。`);
        return;
    }

    // 既にこのチームが仮指名済みかチェック
    if (temporaryDrafts[teamNumber]) {
        alert(`チーム ${teamNumber} は既に ${currentSystemRank} 位の指名を完了しています。`);
        return;
    }
    
    // --- 1. 仮指名の追加 ---
    const newTemporaryDrafts = {
        ...temporaryDrafts,
        [teamNumber]: selectedId
    };

    db.collection("metadata").doc("draft_state").update({
        temporary_drafts: newTemporaryDrafts
    })
    .then(() => {
        alert(`チーム ${teamNumber} の ${currentSystemRank} 位指名を受け付けました。他のチームの指名が完了するまでお待ちください。`);

        // --- 2. 全員完了チェックと一括確定処理 ---
        if (Object.keys(newTemporaryDrafts).length === totalTeamCount) {
            
            // 🚨 全員揃ったので一括確定処理を開始
            alert(`🎉 全チームの指名が完了しました！ ${currentSystemRank} 位の指名結果を確定します...`);
            return finalizeRound(newTemporaryDrafts);
        }
        showRankSelection(); // 仮指名を受け付けたら順位選択画面に戻る
    })
    .catch((error) => {
        console.error("仮指名エラー: ", error);
        alert("指名に失敗しました。コンソールを確認してください。");
    });
}

// --- 一括確定処理のコア関数 ---
function finalizeRound(drafts) {
    const batch = db.batch();
    const rankToFinalize = currentSystemRank;

    // 1. 各候補者ドキュメントに指名情報を反映
    Object.keys(drafts).forEach(teamNumberStr => {
        const teamNumber = parseInt(teamNumberStr);
        const candidateId = drafts[teamNumberStr];
        const candidateRef = db.collection("candidates").doc(candidateId);

        // 配列に指名情報を追加
        batch.update(candidateRef, {
            draft_info: firebase.firestore.FieldValue.arrayUnion({
                team: teamNumber,
                rank: rankToFinalize,
                timestamp: new Date()
            }),
            drafted_by: firebase.firestore.FieldValue.arrayUnion(teamNumber) 
        });
    });

    // 2. メタデータ（状態）をリセットし、次の順位へ進める
    const nextRank = rankToFinalize + 1;
    batch.update(db.collection("metadata").doc("draft_state"), {
        current_rank: nextRank,
        temporary_drafts: {} // 仮指名リストを空にする
    });

    return batch.commit();
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
            return db.collection("metadata").doc("draft_state").update({ current_rank: 1, temporary_drafts: {} });
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

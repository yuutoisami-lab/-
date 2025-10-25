// index.htmlで既に初期化された 'db' (Firestoreインスタンス) を使用します。
// 依存関係: firebase.firestore.FieldValue

// --- 変数と要素の取得 ---
const candidatesList = document.getElementById('candidates');
const candidateSelect = document.getElementById('candidate-select');
const teamSelectionScreen = document.getElementById('team-selection');
const teamNameInputScreen = document.getElementById('team-name-input'); // 新しい画面
const rankSelectionScreen = document.getElementById('rank-selection');
const draftListScreen = document.getElementById('draft-list-screen');
const currentRankTitle = document.getElementById('current-rank-title');
const rankStatusMessage = document.getElementById('rank-status-message');

const userTeamNameInput = document.getElementById('user-team-name');
const assignedTeamNumberInfo = document.getElementById('assigned-team-number-info');

// 選択されたドラフト順位と参加チーム数 (グローバル)
let selectedDraftRank = null; 
let totalTeamCount = null;

// 🚨 ローカルに固定するユーザーのチーム情報
let userTeamNumber = localStorage.getItem('userTeamNumber') ? parseInt(localStorage.getItem('userTeamNumber')) : null;
let userTeamName = localStorage.getItem('userTeamName') || null;

// Firestoreのリアルタイム状態
let currentSystemRank = 1; 
let temporaryDrafts = {}; // { teamNumber: candidateId, ... }
let registeredTeams = {}; // { teamNumber: teamName, ... }

// --- Firestoreからのリアルタイム監視（メタデータと候補者リスト） ---

// 1. メタデータ（現在の順位、仮指名、登録チーム情報）の監視
db.collection("metadata").doc("draft_state").onSnapshot(doc => {
    if (doc.exists) {
        const data = doc.data();
        currentSystemRank = data.current_rank || 1;
        temporaryDrafts = data.temporary_drafts || {};
        totalTeamCount = data.total_teams || null;
        registeredTeams = data.registered_teams || {};
    } else {
        // ドキュメントが存在しない場合、初期値として設定
        db.collection("metadata").doc("draft_state").set({ 
            current_rank: 1, 
            temporary_drafts: {},
            total_teams: null,
            registered_teams: {}
        });
        currentSystemRank = 1;
        temporaryDrafts = {};
        totalTeamCount = null;
        registeredTeams = {};
    }
    
    // UI更新処理を実行
    updateAllUI();
});

// 2. 候補者リストの監視 (既存ロジックとほぼ同じ)
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
        
        let statusText = '👤 未指名';
        li.setAttribute('data-status', 'un-drafted');
        
        if (draftCount > 0) {
            statusText = `✅ ${draftCount} チームが指名済み`;
            li.setAttribute('data-status', 'drafted'); 
        }

        li.textContent = `${candidate.name} (${statusText})`;
        
        if (draftCount > 0) {
            const teamNames = candidate.drafted_by.map(teamNum => {
                // 登録されたチーム名があれば表示、なければ番号を表示
                return registeredTeams[teamNum] ? registeredTeams[teamNum] : `チーム ${teamNum}`;
            }).join(', ');
            li.textContent += ` [指名元: ${teamNames}]`;
        }

        candidatesList.appendChild(li);

        if (draftCount < (totalTeamCount || 1)) {
            const option = document.createElement('option');
            option.value = candidate.id;
            option.textContent = `${candidate.name} (${draftCount} チーム指名)`;
            candidateSelect.appendChild(option);
        }
    });
});

// --- UI更新メイン関数 ---
function updateAllUI() {
    updateRankSelectionUI();
    if (teamNameInputScreen.style.display === 'block') {
        updateTeamNameInputUI();
    }
    if (draftListScreen.style.display === 'block') {
        updateDraftActionUI();
    }
}

// --- 画面遷移ロジック ---

// 参加チーム設定画面を表示
function showTeamSelection() {
    [teamSelectionScreen, teamNameInputScreen, rankSelectionScreen, draftListScreen].forEach(el => el.style.display = 'none');
    teamSelectionScreen.style.display = 'block';
    selectedDraftRank = null;
}

// チーム名入力画面を表示
function showTeamNameInput() {
    [teamSelectionScreen, teamNameInputScreen, rankSelectionScreen, draftListScreen].forEach(el => el.style.display = 'none');
    
    // 既にチーム名が登録されていれば、順位選択にスキップ
    if (userTeamNumber && userTeamName && totalTeamCount) {
        showRankSelection();
        return;
    }

    teamNameInputScreen.style.display = 'block';
    updateTeamNameInputUI();
}

// 順位選択画面を表示
function showRankSelection() {
    if (!userTeamNumber || !totalTeamCount) {
        // チーム情報が不完全なら最初に戻す
        showTeamSelection();
        return;
    }
    
    [teamSelectionScreen, teamNameInputScreen, rankSelectionScreen, draftListScreen].forEach(el => el.style.display = 'none');
    rankSelectionScreen.style.display = 'block';
    selectedDraftRank = null;
    updateRankSelectionUI(); 
}

// チーム数を設定し、次の画面へ遷移する
function setTeamCount(count) {
    if (totalTeamCount !== count) {
         // チーム数が変更されたら、登録済みのチーム情報をリセット
        db.collection("metadata").doc("draft_state").update({
            total_teams: count,
            registered_teams: {}
        }).then(() => {
            alert(`${count}チームでドラフトを開始します。チーム名を入力してください。`);
            // チーム数が変更されたらローカル情報もリセット（再登録を促すため）
            localStorage.removeItem('userTeamNumber');
            localStorage.removeItem('userTeamName');
            userTeamNumber = null;
            userTeamName = null;
            showTeamNameInput();
        });
    } else {
        // チーム数が同じならそのままチーム名入力へ
        showTeamNameInput();
    }
}


// --- チーム名登録ロジック ---

// チーム名入力画面のUIを更新
function updateTeamNameInputUI() {
    if (totalTeamCount) {
        assignedTeamNumberInfo.textContent = `参加チーム数: ${totalTeamCount} チーム`;
    } else {
        assignedTeamNumberInfo.textContent = `先にチーム数を設定してください。`;
    }
    
    // ローカルに情報があれば表示を更新
    if (userTeamName && userTeamNumber) {
        userTeamNameInput.value = userTeamName;
        assignedTeamNumberInfo.textContent += ` (あなた: ${userTeamName} - チーム ${userTeamNumber})`;
        document.querySelector('#team-name-input button').textContent = 'ドラフト順位選択へ進む';
    } else {
        userTeamNameInput.value = '';
        document.querySelector('#team-name-input button').textContent = 'チーム名を登録して開始';
    }
}

// チーム名を登録し、チーム番号を割り当てる
function registerTeamName() {
    const name = userTeamNameInput.value.trim();

    if (!totalTeamCount) {
        alert("先にチーム数を選択してください。");
        showTeamSelection();
        return;
    }
    if (!name) {
        alert("チーム名を入力してください。");
        return;
    }

    // 既に登録済みで、登録ボタンが「進む」ボタンとして機能している場合
    if (userTeamNumber && userTeamName === name) {
        showRankSelection();
        return;
    }

    // 登録可能な最小のチーム番号を探す
    const existingTeamNumbers = Object.keys(registeredTeams).map(Number);
    let nextTeamNumber = 1;
    while (existingTeamNumbers.includes(nextTeamNumber) && nextTeamNumber <= totalTeamCount) {
        nextTeamNumber++;
    }

    if (nextTeamNumber > totalTeamCount) {
        alert(`参加枠(${totalTeamCount}チーム)が全て埋まっています。リセットするか、他の参加者と協力してください。`);
        return;
    }

    // Firestoreにチーム名とチーム番号を登録
    db.collection("metadata").doc("draft_state").update({
        [`registered_teams.${nextTeamNumber}`]: name
    })
    .then(() => {
        // ローカルストレージに保存
        localStorage.setItem('userTeamNumber', nextTeamNumber);
        localStorage.setItem('userTeamName', name);
        userTeamNumber = nextTeamNumber;
        userTeamName = name;
        
        alert(`チーム名「${name}」をチーム ${userTeamNumber} として登録しました！`);
        showRankSelection();
    })
    .catch((error) => {
        console.error("チーム登録エラー:", error);
        alert("チーム名の登録に失敗しました。");
    });
}


// --- UI更新関数 ---

// 順位選択UIを更新
function updateRankSelectionUI() {
    const rankButtons = document.querySelectorAll('#draft-ranks .rank-btn');

    rankButtons.forEach(btn => {
        const rank = parseInt(btn.textContent.match(/\d+/)[0]);
        if (rank === currentSystemRank && currentSystemRank <= 7 && userTeamNumber) {
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

    if (rankStatusMessage && totalTeamCount) {
        if (currentSystemRank <= 7) {
            const completedTeams = Object.keys(temporaryDrafts).length;
            const remainingTeams = totalTeamCount - completedTeams;
            const userDrafted = temporaryDrafts[userTeamNumber];

            let message = `🔥 ${currentSystemRank} 位指名中！`;
            if (userDrafted) {
                 message += ` (あなた: ✅ 指名完了)`;
                 rankStatusMessage.style.backgroundColor = '#ffffcc';
            } else {
                 message += ` (残り ${remainingTeams} チーム)`;
                 rankStatusMessage.style.backgroundColor = '#d4edda'; 
            }
            
            if (completedTeams === totalTeamCount) {
                message = `📢 ${currentSystemRank} 位の指名完了！結果が確定されます...`;
                rankStatusMessage.style.backgroundColor = '#ffc107'; 
            }

            rankStatusMessage.textContent = message;
            rankStatusMessage.style.color = '#155724';
        } else {
            rankStatusMessage.textContent = `✅ ドラフトは終了しました。最終順位: 7 位`;
            rankStatusMessage.style.backgroundColor = '#fff3cd';
            rankStatusMessage.style.color = '#856404';
            rankButtons.forEach(btn => btn.disabled = true);
        }
    }
}

// 指名画面のUIを更新 (自分のチーム名と指名ステータスを表示)
function updateDraftActionUI() {
    if (userTeamName && userTeamNumber) {
        currentRankTitle.textContent = `${userTeamName} (チーム ${userTeamNumber}) の ${currentSystemRank} 位指名`;
    }
    
    // 自分のチームが既に仮指名済みなら、指名ボタンを無効化
    const userDrafted = temporaryDrafts[userTeamNumber];
    const draftActionButton = document.getElementById('draft-action-button');
    
    if (userDrafted) {
        draftActionButton.disabled = true;
        draftActionButton.textContent = '✅ 指名済み (公表を待機中)';
    } else {
        draftActionButton.disabled = false;
        draftActionButton.textContent = '指名候補者を確定';
    }
}


// 順位を選択し、選手一覧画面へ遷移する
function selectRank(rank) {
    if (rank !== currentSystemRank) {
        alert(`現在はドラフト ${currentSystemRank} 位の指名順です。`);
        return;
    }
    
    selectedDraftRank = rank;
    
    rankSelectionScreen.style.display = 'none';
    draftListScreen.style.display = 'block';
    updateDraftActionUI();
}


// --- 指名アクションの関数（仮指名と一括確定） ---
function draftCandidate() {
    const selectedId = candidateSelect.value;
    
    if (!userTeamNumber || !totalTeamCount) {
        alert('先にチーム名を設定してください。');
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

    // 既にこのチームが仮指名済みかチェック
    if (temporaryDrafts[userTeamNumber]) {
        alert(`${userTeamName} (チーム ${userTeamNumber}) は既に ${currentSystemRank} 位の指名を完了しています。`);
        return;
    }
    
    // --- 1. 仮指名の追加 ---
    const newTemporaryDrafts = {
        ...temporaryDrafts,
        [userTeamNumber]: selectedId
    };

    db.collection("metadata").doc("draft_state").update({
        temporary_drafts: newTemporaryDrafts
    })
    .then(() => {
        alert(`チーム ${userTeamName} の ${currentSystemRank} 位指名を受け付けました。他のチームの指名が完了し、公表されるまでお待ちください。`);

        // --- 2. 全員完了チェックと一括確定処理 ---
        if (Object.keys(newTemporaryDrafts).length === totalTeamCount) {
            
            // 🚨 全員揃ったので一括確定処理を開始
            alert(`🎉 全チームの指名が完了しました！ ${currentSystemRank} 位の指名結果を確定し、公表します...`);
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

    return batch.commit()
        .then(() => {
            alert(`✅ ドラフト ${rankToFinalize} 位の指名結果が公表され、${nextRank} 位の指名が始まりました！`);
            showRankSelection();
        });
}


// --- リセット関数（状態管理のリセットも含む） ---
function resetDraft() {
    if (!confirm("本当にドラフト全体をリセットし、全候補者を未指名に戻しますか？")) {
        return;
    }
    
    const batch = db.batch();
    
    // 全候補者を取得し、バッチに削除操作を追加
    db.collection("candidates").get().then((snapshot) => {
        snapshot.forEach((doc) => {
            batch.update(doc.ref, { 
                drafted_by: firebase.firestore.FieldValue.delete(),
                draft_info: firebase.firestore.FieldValue.delete()
            });
        });

        // 1. 候補者の指名情報をリセット
        batch.commit()
        .then(() => {
            // 2. システムの状態を1位にリセット
            return db.collection("metadata").doc("draft_state").update({ 
                current_rank: 1, 
                temporary_drafts: {},
                total_teams: null, // チーム数もリセットして、最初から設定し直す
                registered_teams: {}
            });
        })
        .then(() => {
            // 3. ローカルストレージのチーム情報を削除
            localStorage.removeItem('userTeamNumber');
            localStorage.removeItem('userTeamName');
            userTeamNumber = null;
            userTeamName = null;

            alert("✅ ドラフトはリセットされ、全候補者が未指名になりました。");
            showTeamSelection(); // 最初からやり直し
        })
        .catch((error) => {
            console.error("リセットエラー:", error);
            alert("リセット中にエラーが発生しました。コンソールを確認してください。");
        });
    });
}

// ページロード時に適切な画面を表示する
window.onload = function() {
    if (userTeamNumber && userTeamName && localStorage.getItem('totalTeamCount')) {
        // チーム情報がローカルに残っていれば、順位選択からスタート
        showRankSelection();
    } else {
        // なければ、チーム数選択からスタート
        showTeamSelection();
    }
};

// index.htmlで既に初期化された 'db' (Firestoreインスタンス) と ADMIN_PASSWORD を使用します。

// --- 変数と要素の取得 ---
const candidatesList = document.getElementById('candidates');
const candidateSelect = document.getElementById('candidate-select');
const teamNameInputScreen = document.getElementById('team-name-input');
const rankSelectionScreen = document.getElementById('rank-selection');
const draftListScreen = document.getElementById('draft-list-screen');
const currentRankTitle = document.getElementById('current-rank-title');
const rankStatusMessage = document.getElementById('rank-status-message');
const userTeamNameInput = document.getElementById('user-team-name');
const assignedTeamNumberInfo = document.getElementById('assigned-team-number-info');
const limitReachedScreen = document.getElementById('limit-reached');
const inviteLinkDisplay = document.getElementById('invite-link-display');
const currentTeamSetting = document.getElementById('current-team-setting');

// 管理者ビュー専用の要素
const adminStatusDisplay = document.getElementById('admin-status-display');
const finalizeButton = document.getElementById('finalize-round-button');

const appViews = ['admin-auth', 'admin-control', 'player-view-container'];

// 選択されたドラフト順位と参加チーム数 (グローバル)
let selectedDraftRank = null; 
let totalTeamCount = null;

// 🚨 ローカルに固定するユーザーのチーム情報
let userTeamNumber = localStorage.getItem('userTeamNumber') ? parseInt(localStorage.getItem('userTeamNumber')) : null;
let userTeamName = localStorage.getItem('userTeamName') || null;

// Firestoreのリアルタイム状態
let currentSystemRank = 1; 
let temporaryDrafts = {}; 
let registeredTeams = {}; 
let candidatesData = []; // 全候補者データを保持

// --- ビュー切り替えヘルパー ---
function setView(viewId) {
    appViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const targetEl = document.getElementById(viewId);
    if (targetEl) targetEl.style.display = 'block';
}

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

// 2. 候補者リストの監視
db.collection("candidates").onSnapshot((snapshot) => {
    candidatesData = [];
    snapshot.forEach((doc) => {
        candidatesData.push({ id: doc.id, ...doc.data() });
    });
    
    // 候補者データが更新されたらUIを更新
    updateCandidatesUI();
    updateAdminControlUI(); 
});

// --- UI更新メイン関数 ---
function updateAllUI() {
    updateRankSelectionUI();
    updateTeamNameInputUI();
    updateDraftActionUI();
    updateCandidatesUI();
    updateAdminControlUI(); 
}

// 候補者リストとプルダウンのUIを更新
function updateCandidatesUI() {
    // プレイヤービューのリストを更新
    candidatesList.innerHTML = '';
    candidateSelect.innerHTML = '';

    candidatesData.forEach(candidate => {
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
                return registeredTeams[teamNum] ? registeredTeams[teamNum] : `チーム ${teamNum}`;
            }).join(', ');
            li.textContent += ` [指名元: ${teamNames}]`;
        }

        candidatesList.appendChild(li);

        // プルダウンへの追加
        if (draftCount < (totalTeamCount || 1)) {
            const option = document.createElement('option');
            option.value = candidate.id;
            option.textContent = `${candidate.name} (${draftCount} チーム指名)`;
            candidateSelect.appendChild(option);
        }
    });
}

// --- 管理者認証とビュー制御 ---

function authenticateAdmin() {
    const password = document.getElementById('admin-password').value;
    if (password === ADMIN_PASSWORD) {
        setView('admin-control');
        updateAdminControlUI();
    } else {
        alert("無効なパスワードです。");
    }
}

function showPlayerView() {
    const baseUrl = window.location.origin + window.location.pathname;
    const inviteLink = `${baseUrl}?invite=true`;
    
    // 管理者にリンクを渡したことを確認
    if (navigator.clipboard) {
        navigator.clipboard.writeText(inviteLink).then(() => {
            alert("招待リンクをクリップボードにコピーしました。プレイヤーに配布してください。");
        });
    } else {
        alert("招待リンクをコピーし、プレイヤーに配布してください:\n" + inviteLink);
    }
}

// --- 管理者専用ロジック ---

function updateAdminControlUI() {
    const count = totalTeamCount || '未設定';
    const registeredCount = Object.keys(registeredTeams).length;
    const completedTeams = Object.keys(temporaryDrafts).length;

    // チーム数設定表示
    currentTeamSetting.textContent = `現在の設定: ${count} チーム (${registeredCount} チーム登録済み)`;
    
    // 招待リンク生成
    const baseUrl = window.location.origin + window.location.pathname;
    if (totalTeamCount) {
        inviteLinkDisplay.value = `${baseUrl}?invite=true`;
    } else {
        inviteLinkDisplay.value = 'チーム数を設定してください。';
    }

    // ステータス表示
    let statusHTML = `
        <h3>現在 ${currentSystemRank} 位指名中</h3>
        <p>参加チーム数: <strong>${totalTeamCount || '未設定'}</strong> / 登録済チーム: <strong>${registeredCount}</strong></p>
        <hr>
        <h4>${currentSystemRank} 位の仮指名状況 (${completedTeams} / ${totalTeamCount || registeredCount} チーム完了)</h4>
        <ul style="list-style: none; padding: 0;">
    `;

    if (totalTeamCount) {
        for (let i = 1; i <= totalTeamCount; i++) {
            const teamName = registeredTeams[i] || `チーム ${i}`;
            const candidateId = temporaryDrafts[i];
            const isCompleted = !!candidateId;
            const statusColor = isCompleted ? 'green' : 'gray';
            const statusIcon = isCompleted ? '✅' : '⏳';
            
            let candidateName = '未指名';
            if (candidateId) {
                const candidate = candidatesData.find(c => c.id === candidateId);
                candidateName = candidate ? candidate.name : '不明な候補者';
            }

            statusHTML += `
                <li style="color: ${statusColor}; margin-bottom: 5px;">
                    ${statusIcon} <strong>${teamName}</strong>: ${candidateName}
                </li>
            `;
        }
    } else {
        statusHTML += `<li>チーム数が設定されていません。</li>`;
    }
    statusHTML += `</ul>`;
    adminStatusDisplay.innerHTML = statusHTML;

    // 公表・確定ボタンの制御
    if (completedTeams === totalTeamCount && totalTeamCount > 0) {
        finalizeButton.disabled = false;
        finalizeButton.textContent = `📢 ${currentSystemRank} 位の指名を公表・確定する`;
        finalizeButton.style.backgroundColor = '#ffc107'; 
    } else {
        finalizeButton.disabled = true;
        finalizeButton.textContent = `全チーム指名完了待ち (${completedTeams} / ${totalTeamCount || '?'})`;
        finalizeButton.style.backgroundColor = '#6c757d';
    }
}

function setAdminTeamCount(count) {
    if (count < Object.keys(registeredTeams).length) {
        alert(`現在の登録チーム数(${Object.keys(registeredTeams).length})よりも少ないチーム数には設定できません。リセットしてください。`);
        return;
    }
    
    db.collection("metadata").doc("draft_state").update({
        total_teams: count
    }).then(() => {
        alert(`参加チーム数を ${count} チームに設定しました。`);
        updateAdminControlUI();
    });
}

function copyInviteLink() {
    const link = document.getElementById('invite-link-display');
    if (link.value && link.value.startsWith('http')) {
        link.select();
        document.execCommand('copy');
        alert("招待リンクをコピーしました。");
    }
}

// --- チーム名登録ロジック (プレイヤー) ---

function updateTeamNameInputUI() {
    const registeredCount = Object.keys(registeredTeams).length;
    if (totalTeamCount) {
        assignedTeamNumberInfo.textContent = `参加枠: ${totalTeamCount} チーム (現在 ${registeredCount} チーム登録済み)`;
    } else {
        assignedTeamNumberInfo.textContent = `管理者がまだチーム数を設定していません。`;
    }
    
    if (userTeamName && userTeamNumber) {
        userTeamNameInput.value = userTeamName;
        assignedTeamNumberInfo.textContent += ` (あなたのチーム: ${userTeamName} - チーム ${userTeamNumber})`;
        document.querySelector('#team-name-input button').textContent = 'ドラフト順位選択へ進む';
    } else {
        userTeamNameInput.value = '';
        document.querySelector('#team-name-input button').textContent = 'チーム名を登録して開始';
    }
}

function registerTeamName() {
    const name = userTeamNameInput.value.trim();

    if (!totalTeamCount) {
        alert("管理者がチーム数を設定していません。");
        return;
    }
    if (!name) {
        alert("チーム名を入力してください。");
        return;
    }
    if (Object.values(registeredTeams).includes(name)) {
        alert("そのチーム名は既に使われています。別の名前を入力してください。");
        return;
    }

    if (userTeamNumber && localStorage.getItem('userTeamName') === name) {
        showRankSelection();
        return;
    }

    const existingTeamNumbers = Object.keys(registeredTeams).map(Number);
    let nextTeamNumber = 1;
    while (existingTeamNumbers.includes(nextTeamNumber) && nextTeamNumber <= totalTeamCount) {
        nextTeamNumber++;
    }

    if (nextTeamNumber > totalTeamCount) {
        showLimitReached();
        return;
    }

    db.collection("metadata").doc("draft_state").update({
        [`registered_teams.${nextTeamNumber}`]: name
    })
    .then(() => {
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

// --- プレイヤービュー内の画面遷移とUI更新 ---

function showTeamNameInput() {
    if (!totalTeamCount) { /* ... */ }

    const currentRegisteredCount = Object.keys(registeredTeams).length;
    if (currentRegisteredCount >= totalTeamCount && !userTeamNumber) {
        showLimitReached();
        return;
    }
    const phases = document.querySelectorAll('#player-view-container .player-phase');
    phases.forEach(el => el.style.display = 'none');
    teamNameInputScreen.style.display = 'block';

    updateTeamNameInputUI();
}

function showLimitReached() {
    const phases = document.querySelectorAll('#player-view-container .player-phase');
    phases.forEach(el => el.style.display = 'none');
    limitReachedScreen.style.display = 'block';
}

function showRankSelection() {
    if (!userTeamNumber || !totalTeamCount) {
        showTeamNameInput();
        return;
    }
    
    const phases = document.querySelectorAll('#player-view-container .player-phase');
    phases.forEach(el => el.style.display = 'none');
    rankSelectionScreen.style.display = 'block';
    selectedDraftRank = null;
    updateRankSelectionUI(); 
}

function selectRank(rank) {
    if (rank !== currentSystemRank) {
        alert(`現在はドラフト ${currentSystemRank} 位の指名順です。`);
        return;
    }
    selectedDraftRank = rank;
    const phases = document.querySelectorAll('#player-view-container .player-phase');
    phases.forEach(el => el.style.display = 'none');
    draftListScreen.style.display = 'block';
    updateDraftActionUI();
}

// --- 指名アクションの関数 ---

function draftCandidate() {
    const selectedId = candidateSelect.value;
    
    if (!userTeamNumber || !totalTeamCount) { alert('チーム名を設定してください。'); showTeamNameInput(); return; }
    if (selectedDraftRank !== currentSystemRank) { alert(`指名順が正しくありません。`); showRankSelection(); return; }
    if (!selectedId) { alert('指名する候補者を選択してください。'); return; }

    const teamNumber = userTeamNumber;

    if (temporaryDrafts[teamNumber]) { alert(`${userTeamName} は既に ${currentSystemRank} 位の指名を完了しています。`); return; }
    
    const newTemporaryDrafts = { ...temporaryDrafts, [teamNumber]: selectedId };

    db.collection("metadata").doc("draft_state").update({ temporary_drafts: newTemporaryDrafts })
    .then(() => {
        alert(`チーム ${userTeamName} の ${currentSystemRank} 位指名を受け付けました。管理者の公表操作をお待ちください。`);
        showRankSelection(); 
    })
    .catch((error) => { console.error("仮指名エラー: ", error); alert("指名に失敗しました。コンソールを確認してください。"); });
}


// --- 管理者手動実行用の確定処理 ---

// 管理者ボタンから呼び出される
function finalizeRoundManual() {
    if (Object.keys(temporaryDrafts).length !== totalTeamCount) {
        alert("エラー: 全チームの仮指名が完了していません。");
        return;
    }
    if (!confirm(`本当にドラフト ${currentSystemRank} 位の指名結果を公表・確定しますか？`)) {
        return;
    }

    const drafts = temporaryDrafts;
    const batch = db.batch();
    const rankToFinalize = currentSystemRank;

    // 1. 各候補者ドキュメントに指名情報を反映
    Object.keys(drafts).forEach(teamNumberStr => {
        const teamNumber = parseInt(teamNumberStr);
        const candidateId = drafts[teamNumberStr];
        const candidateRef = db.collection("candidates").doc(candidateId);

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
            updateAdminControlUI();
        })
        .catch((error) => {
            console.error("確定処理エラー:", error);
            alert("確定処理中にエラーが発生しました。");
        });
}


function resetDraft() {
    if (!confirm("🚨 管理者権限: 本当にドラフト全体をリセットし、最初からやり直しますか？")) { return; }
    
    const batch = db.batch();
    db.collection("candidates").get().then((snapshot) => {
        snapshot.forEach((doc) => {
            batch.update(doc.ref, { 
                drafted_by: firebase.firestore.FieldValue.delete(),
                draft_info: firebase.firestore.FieldValue.delete()
            });
        });

        batch.commit()
        .then(() => {
            return db.collection("metadata").doc("draft_state").update({ 
                current_rank: 1, 
                temporary_drafts: {},
                total_teams: null,
                registered_teams: {}
            });
        })
        .then(() => {
            localStorage.removeItem('userTeamNumber');
            localStorage.removeItem('userTeamName');
            userTeamNumber = null;
            userTeamName = null;
            alert("✅ 全てのドラフト状態がリセットされました。");
            setView('admin-control');
        });
    });
}

// --- 初期ロード時のルーティング ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('invite') === 'true' || userTeamNumber) {
        // 招待リンクまたは既存ユーザーとしてアクセス
        setView('player-view-container');
        showTeamNameInput();
    } else {
        // 通常アクセス、管理者認証から
        setView('admin-auth');
    }
};

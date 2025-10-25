// index.htmlで既に初期化された 'db' (Firestoreインスタンス) を使用します。

// --- 新しい変数と要素の取得 ---
const candidatesList = document.getElementById('candidates');
const candidateSelect = document.getElementById('candidate-select');
const teamSelectionScreen = document.getElementById('team-selection'); // 新しい要素
const rankSelectionScreen = document.getElementById('rank-selection');
const draftListScreen = document.getElementById('draft-list-screen');
const currentRankTitle = document.getElementById('current-rank-title');

// 選択された現在のドラフト順位とチーム数を保持する変数
let selectedDraftRank = null; 
let totalTeamCount = null; // 👈 新しい変数：参加チーム数を保持

// --- 画面遷移ロジックの修正 ---

// 参加チーム設定画面を表示する
function showTeamSelection() {
    draftListScreen.style.display = 'none';
    rankSelectionScreen.style.display = 'none';
    teamSelectionScreen.style.display = 'block';
    selectedDraftRank = null;
    // totalTeamCount はリセットしない (一度設定したら維持)
}

// 順位選択画面を表示する（既存関数を修正）
function showRankSelection() {
    draftListScreen.style.display = 'none';
    rankSelectionScreen.style.display = 'block';
    teamSelectionScreen.style.display = 'none';
    selectedDraftRank = null;
}

// チーム数を設定し、順位選択画面へ遷移する（新しい関数）
function setTeamCount(count) {
    totalTeamCount = count;
    alert(`${count}チームでドラフトを開始します。`); // 確認メッセージ
    showRankSelection(); // 次の順位選択画面へ遷移
}


// 順位を選択し、選手一覧画面へ遷移する（既存関数）
function selectRank(rank) {
    // ... 既存のロジックは変更なし ...
    selectedDraftRank = rank;
    currentRankTitle.textContent = `ドラフト ${rank} 位の指名候補者`;
    
    rankSelectionScreen.style.display = 'none';
    draftListScreen.style.display = 'block';

    console.log(`ドラフト ${rank} 位が選択されました。`);
}


// --- データベースからのリアルタイム監視（重複の表示に対応） ---
db.collection("candidates").onSnapshot((snapshot) => {
    candidatesList.innerHTML = '';
    candidateSelect.innerHTML = '';
    
    const candidates = [];
    
    snapshot.forEach((doc) => {
        candidates.push({ id: doc.id, ...doc.data() });
    });

    // 候補者をソートするロジックは一旦変更なし
    // ... 

    candidates.forEach(candidate => {
        const li = document.createElement('li');
        
        // 🚨 重複指名の確認
        const draftCount = candidate.drafted_by ? candidate.drafted_by.length : 0;
        
        // --- 表示テキストの調整 ---
        let statusText = '👤 未指名';
        if (draftCount > 0) {
            statusText = `✅ ${draftCount} チームが指名済み`;
            li.setAttribute('data-status', 'drafted'); // スタイルを適用
        } else {
            li.setAttribute('data-status', 'un-drafted');
        }

        li.textContent = `${candidate.name} (${statusText})`;
        
        // 重複チームリストを詳細として追加（オプション）
        if (draftCount > 0) {
            const teamList = candidate.drafted_by.map(team => `チーム ${team}`).join(', ');
            li.textContent += ` [指名元: ${teamList}]`;
        }

        candidatesList.appendChild(li);

        // --- プルダウンへの追加ロジック ---
        // 指名チーム数が総チーム数未満の場合、プルダウンに追加
        if (totalTeamCount && draftCount < totalTeamCount) {
            const option = document.createElement('option');
            option.value = candidate.id;
            option.textContent = `${candidate.name} (${draftCount} チーム指名)`;
            candidateSelect.appendChild(option);
        }
    });
});


// --- 指名アクションの関数（重複に対応したデータ構造に変更） ---
function draftCandidate() {
    const selectedId = candidateSelect.value;
    
    if (!totalTeamCount) {
        alert('先にドラフト参加チーム数を設定してください。');
        showTeamSelection();
        return;
    }
    if (!selectedDraftRank) {
        alert('先に指名順位を選択してください。');
        return;
    }
    if (!selectedId) {
        alert('指名する候補者を選択してください。');
        return;
    }

    const candidateRef = db.collection("candidates").doc(selectedId);
    
    // ⚠️ 誰が指名したかわかるように、チーム番号（1からtotalTeamCountまで）をユーザーに入力させる
    let teamNumber = prompt(`指名を行うのは何番目のチームですか？ (1から${totalTeamCount}の数字を入力)`);
    teamNumber = parseInt(teamNumber);

    if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > totalTeamCount) {
        alert(`無効なチーム番号です。1から${totalTeamCount}の数字を入力してください。`);
        return;
    }

    // 重複を記録するために、Firestoreの配列操作 (arrayUnion) を使用
    candidateRef.update({
        // draft_info は指名履歴の配列とする
        draft_info: firebase.firestore.FieldValue.arrayUnion({
            team: teamNumber,
            rank: selectedDraftRank,
            timestamp: new Date()
        }),
        // 指名したチーム番号のリスト（表示用）
        drafted_by: firebase.firestore.FieldValue.arrayUnion(teamNumber) 
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
// ... resetDraft 関数はそのまま使用可能 ...

// --- データの初期構造の変更点 ---
/*
    Firestore のデータ構造を以下のように変更する必要があります。
    コレクション名: 'candidates'
    ドキュメントID (自動生成)
      - name: "候補者 A" (string)
      - drafted_by: [] (array, 指名したチーム番号のリスト) <-- 新しいフィールド
      - draft_info: [] (array, 指名詳細 {team: 1, rank: 1, timestamp: ...}) <-- 新しいフィールド

    ※古い status: "un-drafted" フィールドは、新しいロジックでは不要になりますが、
      リセットのために status: "un-drafted" を残しておく方が安全かもしれません。
      （本ロジックでは drafted_by が空かどうかで判断しています）
*/
// ドラフトをリセットする関数
function resetDraft() {
    if (!confirm("本当にドラフト全体をリセットし、全候補者を未指名に戻しますか？")) {
        return;
    }
    
    const batch = db.batch();
    
    // 全候補者を取得
    db.collection("candidates").get().then((snapshot) => {
        snapshot.forEach((doc) => {
            // 各ドキュメントの status を un-drafted に設定するバッチ処理に追加
            batch.update(doc.ref, { 
                status: "un-drafted",
                drafted_rank: firebase.firestore.FieldValue.delete(), // 順位記録を削除
                draftedAt: firebase.firestore.FieldValue.delete()      // 指名日時を削除
            });
        });

        // バッチ処理を実行
        return batch.commit();
    })
    .then(() => {
        alert("✅ ドラフトはリセットされ、全候補者が未指名になりました。");
        showRankSelection(); // 順位選択画面に戻る
    })
    .catch((error) => {
        console.error("リセットエラー:", error);
        alert("リセット中にエラーが発生しました。コンソールを確認してください。");
    });
}

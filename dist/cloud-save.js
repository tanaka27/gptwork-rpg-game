'use strict';
(() => {
  const date = value => new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + '（日本時間）';
  const button = $('cloudSave'),
    dialog = $('cloudDialog'),
    status = $('cloudStatus');
  let remote = null;
  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json' } }),
      result = await response.json();
    if (!response.ok) throw new Error(result.error || '接続できません');
    return result;
  }
  function summary(saved) {
    return saved
      ? 'Lv. ' + saved.lv + ' / ' + (nodeById(saved.node)?.name || saved.node) + ' / ' + saved.gold + ' G'
      : 'まだ保存されていません';
  }
  async function refresh() {
    status.textContent = '読み込み中…';
    try {
      remote = await api('/api/save');
      $('localSaveInfo').textContent = summary(state);
      $('remoteSaveInfo').textContent = summary(remote.state);
      $('restoreCloud').disabled = !remote.state || busy || roundActive;
      $('uploadCloud').disabled = busy || roundActive;
      status.textContent = remote.state ? '更新: ' + date(remote.updatedAt) : '最初の保存で現在の進行を取り込みます。';
      const history = await api('/api/save/history');
      $('cloudHistory').replaceChildren();
      for (const entry of history.history) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = '版 ' + entry.revision + ' · ' + date(entry.created_at);
        $('cloudHistory').append(option);
      }
      $('restoreHistory').disabled = !history.history.length || busy || roundActive;
    } catch (error) {
      status.textContent = error.message;
      $('uploadCloud').disabled = true;
      $('restoreCloud').disabled = true;
      $('restoreHistory').disabled = true;
    }
  }
  button.disabled = !!window.GamePreview;
  button.onclick = () => {
    if (busy || roundActive) return;
    dialog.showModal();
    refresh();
  };
  $('closeCloud').onclick = () => dialog.close();
  $('uploadCloud').onclick = async () => {
    if (busy || roundActive || !remote) return;
    if (remote.state && !confirm('現在の進行でクラウドセーブを更新しますか？ 更新前のクラウドセーブは履歴へ残します。'))
      return;
    try {
      status.textContent = '保存中…';
      $('uploadCloud').disabled = true;
      await api('/api/save', { method: 'PUT', body: JSON.stringify({ state, revision: remote.revision }) });
      await refresh();
      status.textContent = 'クラウドに保存しました。ブラウザ内の自動保存も残っています。';
    } catch (error) {
      status.textContent = error.message + ' ローカルの進行は保持されています。';
      $('uploadCloud').disabled = false;
    }
  };
  async function restore(saved) {
    if (busy || roundActive) return;
    const errors = SaveRules.validate(saved, GameData);
    if (errors.length) throw new Error(errors.join('\n'));
    if (!confirm('このセーブを復元しますか？ 現在の進行は復元前バックアップとしてこのブラウザへ残します。')) return;
    localStorage.setItem('starlight-before-cloud-restore', JSON.stringify(state));
    GameStorage.write(saved);
    location.reload();
  }
  $('restoreCloud').onclick = () => restore(remote.state).catch(error => (status.textContent = error.message));
  $('restoreHistory').onclick = async () => {
    try {
      const id = $('cloudHistory').value;
      if (id) await restore((await api('/api/save/history/' + encodeURIComponent(id))).state);
    } catch (error) {
      status.textContent = error.message;
    }
  };
})();

function clearSelection() {
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  } else if (document.selection) {
    document.selection.empty();
  }
}

function copyLink() {
  const target = document.getElementById('shortened-url');
  const range = document.createRange();
  range.selectNode(target);
  window.getSelection().addRange(range);
  document.execCommand('copy');
  M.toast({html: 'Link copied!'});
  clearSelection();
}

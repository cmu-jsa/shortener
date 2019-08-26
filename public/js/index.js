function createInput(link) {
  const textArea = document.createElement('input');
  textArea.setAttribute('value', link);
  textArea.setAttribute('id', 'shortened-url');
  textArea.setAttribute('class', 'hidden');
  const div = document.getElementById('forCopy');
  div.appendChild(textArea);
}

function copyInputContents() {
  const copyText = document.getElementById('shortened-url');
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  document.execCommand('copy');
}

function removeInput() {
  const parent = document.getElementById('forCopy');
  const input = document.getElementById('shortened-url');
  parent.removeChild(input);
}

/**
 * Copies {link} to clipboard
 */
function copyLink(link) {
  createInput(link);
  copyInputContents();
  removeInput();
  M.toast({html: 'Link copied!'});
}

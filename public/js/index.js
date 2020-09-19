document.getElementById('copyButton').addEventListener('click', (e) => {
  navigator.clipboard.writeText(e.target.innerText);
  M.toast({ html: 'Link copied!' });
});

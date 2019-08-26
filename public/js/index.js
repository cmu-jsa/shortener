function copyLink(link) {
  const copyText = `jsa.life/${link}`;
  const listener = (e) => {
    e.clipboardData.setData('text/plain' , copyText);
    e.preventDefault();
    document.removeEventListener('copy', listener);
  };

  document.addEventListener('copy' , listener);
  document.execCommand('copy');
  M.toast({html: 'Link copied!'});
}

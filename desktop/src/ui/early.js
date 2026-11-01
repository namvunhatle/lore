// Runs before first paint so a private tab never flashes the light theme.
if (new URLSearchParams(location.search).get('private') === '1') document.documentElement.setAttribute('data-private', '');

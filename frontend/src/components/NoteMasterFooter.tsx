export const NOTEMASTER_URL = 'https://www.notemaster.com.br/';
export const DEVELOPER_URL = 'https://www.reddit.com/user/marquinhodecastro/';

export function NoteMasterFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="nm-footer">
      <p>
        © {year}{' '}
        <a href={NOTEMASTER_URL} target="_blank" rel="noreferrer">
          notemaster
        </a>. Todos os direitos reservados.
      </p>
      <p>
        Desenvolvido por{' '}
        <a href={DEVELOPER_URL} target="_blank" rel="noreferrer">
          Marco de Castro
        </a>
      </p>
    </footer>
  );
}

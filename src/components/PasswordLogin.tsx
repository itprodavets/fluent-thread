import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { cloud } from '../domain/cloud';
import { passwordLogin, resetProfilePassword } from '../domain/password-auth';
export function PasswordLogin() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const emailInput=useRef<HTMLInputElement>(null);
  async function signIn(event:FormEvent) {
    event.preventDefault();if(!cloud || busy) return;
    setBusy(true);setMessage('');
    const result=await passwordLogin(cloud.auth,email,password);
    if(result.error) setMessage(result.error);
    else {setPassword('');location.hash='#profile';}
    setBusy(false);
  }
  async function recover() {
    if(!cloud || busy || !emailInput.current?.reportValidity()) return;
    setBusy(true);setMessage('');
    const result=await resetProfilePassword(cloud.auth,email,location.origin+location.pathname+'#profile');
    setMessage(result.error??'Если этот email зарегистрирован, на него отправлено письмо восстановления. Открой ссылку и установи новый пароль в профиле.');
    setBusy(false);
  }
  return <section aria-label="Вход с паролем">
    <h3>Войти с паролем</h3>
    <form onSubmit={signIn}>
      <label>Email<input ref={emailInput} type="email" required value={email} onChange={event=>{setEmail(event.target.value);setMessage('');}} autoComplete="username" disabled={busy} /></label>
      <label>Пароль<input type="password" required value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" disabled={busy} /></label>
      <div className="actions"><button type="submit" className="primary" disabled={busy}>{busy?'Подожди…':'Войти с паролем'}</button><button type="button" disabled={busy} onClick={()=>void recover()}>Забыл пароль</button></div>
    </form>
    <p className="sub">Если пароль ещё не установлен, войди через письмо один раз и установи пароль в профиле. Затем письма при обычном входе не понадобятся.</p>
    {message && <p role="status">{message}</p>}
  </section>;
}

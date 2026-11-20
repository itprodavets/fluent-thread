import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { cloud } from '../domain/cloud';
import { setProfilePassword } from '../domain/password-auth';
import { useIdentity } from '../profiles';
export function PasswordSettings() {
  const {user,recovering,finishRecovery}=useIdentity();
  const [open,setOpen]=useState(recovering);
  useEffect(()=>{if(recovering) setOpen(true);},[recovering]);
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [current,setCurrent]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  async function save(event:FormEvent) {
    event.preventDefault();if(!cloud || busy) return;
    setBusy(true);setMessage('');
    const result=await setProfilePassword(cloud.auth,password,confirmation,current);
    if(result.error) setMessage(result.error);
    else {
      setPassword('');setConfirmation('');setCurrent('');finishRecovery();
      setMessage('Пароль сохранён. Теперь можно входить по email и паролю на телефоне и компьютере.');
    }
    setBusy(false);
  }
  if(!cloud || !user) return null;
  return <details className="fold" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{recovering?'Восстановление пароля':'Установить или изменить пароль'}</summary>
    <p>Установи пароль для входа без письма. Пароль не сохраняется в учебных материалах, статистике или резервной копии — его обрабатывает Supabase Auth.</p>
    <form onSubmit={save}>
      <label>Email профиля<input type="email" value={user.email??''} readOnly autoComplete="username" /></label>
      {!recovering && <label>Текущий пароль, если уже установлен<input type="password" value={current} onChange={event=>setCurrent(event.target.value)} autoComplete="current-password" disabled={busy} /></label>}
      <label>Новый пароль<input type="password" required minLength={12} value={password} onChange={event=>setPassword(event.target.value)} autoComplete="new-password" disabled={busy} /></label>
      <label>Повтори новый пароль<input type="password" required minLength={12} value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="new-password" disabled={busy} /></label>
      <p className="sub">Не меньше 12 символов. Сохрани пароль в своём менеджере паролей.</p>
      <button type="submit" className="primary" disabled={busy}>{busy?'Сохраняем…':'Сохранить пароль'}</button>
    </form>
    {message && <p role="status">{message}</p>}
  </details>;
}

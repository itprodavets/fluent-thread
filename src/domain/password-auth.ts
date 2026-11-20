type ProviderError = { code?: string };
type Reply = { error: ProviderError | null };
type LoginAuth = { signInWithPassword(value:{email:string;password:string}):Promise<Reply> };
type UpdateAuth = { updateUser(value:{password:string;current_password?:string}):Promise<Reply> };
type ResetAuth = { resetPasswordForEmail(email:string, options:{redirectTo:string}):Promise<Reply> };
type Result = { error?: string };
export function passwordProblem(password:string,confirmation:string) {
  if(password.length<12) return 'Используй пароль длиной не меньше 12 символов.';
  if(password!==confirmation) return 'Пароли не совпадают.';
}
function providerMessage(error:ProviderError,operation:'login'|'update'|'reset') {
  if(error.code==='invalid_credentials') return 'Не удалось войти. Проверь email и пароль. Если пароль ещё не установлен, войди по письму и установи его в профиле.';
  if(error.code==='email_not_confirmed') return 'Сначала подтверди email по письму регистрации.';
  if(error.code==='reauthentication_needed' || error.code==='reauthentication_not_valid') return 'Для изменения пароля войди в профиль заново, затем повтори сохранение. Защита аккаунта требует свежего подтверждения входа.';
  if(error.code==='same_password') return 'Этот пароль уже установлен. Выбери другой, если хочешь его изменить.';
  if(error.code==='weak_password') return 'Пароль не прошёл проверку безопасности. Используй длинный уникальный пароль.';
  if(error.code==='over_request_rate_limit' || error.code==='over_email_send_rate_limit') return 'Сервис временно ограничил попытки. Подожди и попробуй позже.';
  return operation==='login' ? 'Не удалось войти. Проверь подключение и попробуй снова.'
    : operation==='update' ? 'Не удалось сохранить пароль. Проверь подключение и повтори попытку.'
    : 'Не удалось отправить письмо восстановления. Попробуй позже или войди через письмо.';
}
export async function passwordLogin(auth:LoginAuth,email:string,password:string):Promise<Result> {
  if(!email.trim() || !password) return {error:'Введи email и пароль.'};
  try {const {error}=await auth.signInWithPassword({email:email.trim(),password});return error?{error:providerMessage(error,'login')} : {};}
  catch {return {error:providerMessage({},'login')};}
}
export async function setProfilePassword(auth:UpdateAuth,password:string,confirmation:string,currentPassword=''):Promise<Result> {
  const invalid=passwordProblem(password,confirmation);if(invalid) return {error:invalid};
  try {
    const {error}=await auth.updateUser({password,...(currentPassword ? {current_password:currentPassword} : {})});
    return error?{error:providerMessage(error,'update')} : {};
  } catch {return {error:providerMessage({},'update')};}
}
export async function resetProfilePassword(auth:ResetAuth,email:string,redirectTo:string):Promise<Result> {
  if(!email.trim()) return {error:'Укажи email профиля.'};
  try {const {error}=await auth.resetPasswordForEmail(email.trim(),{redirectTo});return error && error.code!=='user_not_found' ? {error:providerMessage(error,'reset')} : {};}
  catch {return {error:providerMessage({},'reset')};}
}

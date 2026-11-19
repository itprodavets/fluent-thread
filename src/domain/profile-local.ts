let owner = 'guest';
export function setLocalOwner(value: string) { owner = value; }
export function localOwner() { return owner; }
export function ownedDatabase(name: string, id = owner) { return id === 'guest' ? name : name + ':' + id; }
export function ownedKey(name: string) { return owner === 'guest' ? name : name + ':' + owner; }

// One shared pure error constructor. Account/server codec keep the same binding.
export class AccountError extends Error {
  status: number;
  constructor(status: number, code: string) { super(code); this.status = status; }
}

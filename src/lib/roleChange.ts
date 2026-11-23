export const ROLE_CHANGED_MESSAGE = 'Your role changed — please try again.'

// The pages pick the save RPC from my_role's in_training. When an admin switches training on or
// off after that was read, the server refuses the save with 42501 and one of these messages.
const NOW_TRAINEE = /held for approval/i // save/review/confirm RPC called by a trainee
const NO_LONGER_TRAINEE = /only a volunteer in training/i // submit_* called by a non-trainee

// The notice to show (after re-reading the role) when a refused save means the role changed;
// null for any other answer. forbidden: the server answered 42501. trainee: the page called submit_*.
export function roleChangedMessage(forbidden: boolean, serverMessage: string | undefined, trainee: boolean): string | null {
  if (!forbidden || !serverMessage) return null
  return (trainee ? NO_LONGER_TRAINEE : NOW_TRAINEE).test(serverMessage) ? ROLE_CHANGED_MESSAGE : null
}

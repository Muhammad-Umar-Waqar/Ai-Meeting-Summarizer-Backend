export function generateMeetingCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segment = (len) => {
    let res = '';
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

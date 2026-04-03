import { redirect } from 'next/navigation';
import { nanoid } from 'nanoid';

export default function AppHomePage() {
  const chatId = nanoid();
  redirect(`/chat/${chatId}`);
}

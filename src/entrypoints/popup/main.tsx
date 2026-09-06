import { render } from 'preact';
import '@/ui/styles/tokens.css';
import { Popup } from './Popup';

const root = document.getElementById('app');
if (root) {
  render(<Popup />, root);
}

import 'lucide-react-native';

declare module 'lucide-react-native' {
  import { SvgProps } from 'react-native-svg';

  export interface LucideProps extends SvgProps {
    size?: number | string;
    color?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number | string;
    className?: string;
  }
}

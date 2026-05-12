declare module 'react-plotly.js' {
  import { Component } from 'react';
  interface PlotParams {
    data: object[];
    layout?: object;
    config?: object;
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    onInitialized?: (figure: object, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: object, graphDiv: HTMLElement) => void;
    onClick?: (event: object) => void;
    onHover?: (event: object) => void;
    className?: string;
  }
  export default class Plot extends Component<PlotParams> {}
}

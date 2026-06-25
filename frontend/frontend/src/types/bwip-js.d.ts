declare module 'bwip-js' {
    interface BwipOptions {
        bcid: string;
        text: string;
        scale?: number;
        height?: number;
        width?: number;
        includetext?: boolean;
        textxalign?: string;
        parsefnc?: boolean;
        [key: string]: any;
    }
    function toCanvas(canvas: HTMLCanvasElement, options: BwipOptions): HTMLCanvasElement;
    function toSVG(options: BwipOptions): string;
    export { toCanvas, toSVG };
    export default { toCanvas, toSVG };
}

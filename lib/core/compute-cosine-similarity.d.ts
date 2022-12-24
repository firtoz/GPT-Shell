declare module 'compute-cosine-similarity' {
    export default function similarity<TX = number, TY = number>(x: TX[], y: TY[], clbk?: (x: TX, y: TY) => number): number;
}

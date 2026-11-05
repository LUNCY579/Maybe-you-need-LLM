import PlotlyCore from 'plotly.js/lib/core';
import scatter from 'plotly.js/lib/scatter';
import scatter3d from 'plotly.js/lib/scatter3d';
import histogram from 'plotly.js/lib/histogram';
import heatmap from 'plotly.js/lib/heatmap';
import contour from 'plotly.js/lib/contour';
import surface from 'plotly.js/lib/surface';

/**
 * A small Plotly.
 *
 * The full distribution is 4.7 megabytes of every trace type there is, and
 * evaluating it on the main thread costs the reader about half a second of
 * frozen page — which is the single largest thing this application does to
 * the reader's browser.
 *
 * The application draws five kinds of trace: a scatter (lines and markers), a
 * histogram, a heatmap, a contour, and the two three-dimensional ones (a
 * surface and a scatter in 3D). Only those are registered, and the result is a
 * fraction of the size. The core is the same code either way, so the charts
 * are the same charts.
 */
PlotlyCore.register([scatter, scatter3d, histogram, heatmap, contour, surface]);

export default PlotlyCore;

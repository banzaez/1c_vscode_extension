import {
  pictureMimeFromData,
  resolveMxlPicture
} from './layout.js';

function pictureToObjectUrl(picture) {
  if (!picture || !picture.data) return '';
  var mime = pictureMimeFromData(picture.data);
  try {
    var binary = atob(picture.data);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch (e) {
    return 'data:' + mime + ';base64,' + picture.data;
  }
}

/** Подставляет src картинкам после mount (innerHTML не переносит длинные data: URI в webview). */
export function hydrateDrawingImages(mxlData, root) {
  if (!mxlData || !root) return;

  var overlay = root.querySelector('.mxl-drawing-overlay');
  if (!overlay) return;

  var imgs = overlay.querySelectorAll('img.mxl-drawing-picture[data-drawing-index]');
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    var drawingIdx = parseInt(img.getAttribute('data-drawing-index'), 10);
    if (isNaN(drawingIdx)) continue;

    var drawing = (mxlData.drawings || [])[drawingIdx];
    if (!drawing) continue;

    var picture = resolveMxlPicture(mxlData.pictures, drawing.pictureIndex);
    if (!picture) continue;

    var url = pictureToObjectUrl(picture);
    if (!url) continue;

    if (img._mxlObjectUrl) {
      URL.revokeObjectURL(img._mxlObjectUrl);
    }
    if (url.indexOf('blob:') === 0) {
      img._mxlObjectUrl = url;
    }
    img.src = url;
  }
}

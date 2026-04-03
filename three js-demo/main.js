const img = document.querySelector(".face-image");

// VISMES (just simple CSS transforms for now)
function setViseme(type) {
  if (!img) return;

  switch (type) {
    case "AI":
      img.style.transform = "scaleY(1.1)";
      break;
    case "EH":
      img.style.transform = "scaleX(1.05)";
      break;
    case "FV":
      img.style.transform = "translateY(5px)";
      break;
    case "MM":
      img.style.transform = "scale(0.95)";
      break;
    default:
      img.style.transform = "none";
  }
}

// EMOTIONS (simple color filters)
function setEmotion(type, value) {
  value = Number(value);

  let filter = "";

  if (type === "joy") filter = `brightness(${1 + value * 0.3})`;
  if (type === "anger") filter = `hue-rotate(${value * 20}deg) saturate(${1 + value})`;
  if (type === "surprise") filter = `contrast(${1 + value * 0.5})`;
  if (type === "sadness") filter = `grayscale(${value})`;

  img.style.filter = filter;

  document.getElementById("emotionLabel").textContent =
    "Current Emotion: " + type.charAt(0).toUpperCase() + type.slice(1);
}

// EYE GAZE (move the image slightly)
function setGaze(x, y) {
  const current = img.style.transform.replace(/translate.*?\)/, "");

  const tx = x !== null ? x * 10 : 0;
  const ty = y !== null ? y * 10 : 0;

  img.style.transform = `${current} translate(${tx}px, ${ty}px)`;
}

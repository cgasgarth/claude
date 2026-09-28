#!/usr/bin/env bash
# Status line: ctx is the live window. session is window growth only.
# Output from a finished turn is already in the next window, so it
# must not be added again. After compact, the baseline resets.
set -euo pipefail

input=$(cat)
model=$(printf '%s' "$input" | jq -r '.model.display_name // .model.id // "unknown"')
effort=$(printf '%s' "$input" | jq -r '.effort.level // "n/a"')
context_tokens=$(printf '%s' "$input" | jq -r '.context_window.total_input_tokens // empty')
window_size=$(printf '%s' "$input" | jq -r '.context_window.context_window_size // empty')
used=$(printf '%s' "$input" | jq -r '.context_window.used_percentage // empty')
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty')

session_tokens=0
if [ -r "${transcript}" ]; then
  session_tokens=$(
    jq -s '
      [
        .[]
        | select(.message.usage?)
        | {
            id: (.message.id // .messageId // .uuid),
            usage: .message.usage
          }
      ]
      | group_by(.id)
      | map(.[-1].usage)
      | reduce .[] as $u (
          {prev: 0, total: 0};
          (
            (($u.input_tokens // 0)
              + ($u.cache_creation_input_tokens // 0)
              + ($u.cache_read_input_tokens // 0)) as $window
            | if $window > .prev then
                .total += ($window - .prev) | .prev = $window
              else
                .prev = $window
              end
          )
        )
      | .total
    ' "$transcript" 2>/dev/null || printf '0'
  )
fi

fmt_tokens() {
  awk -v n="$1" 'BEGIN {
    suffix = ""
    v = n
    if (n >= 999950000) { v = n / 1000000000; suffix = "b" }
    else if (n >= 999950) { v = n / 1000000; suffix = "m" }
    else if (n >= 1000) { v = n / 1000; suffix = "k" }
    if (suffix == "") {
      printf "%.0f", v
    } else {
      s = sprintf("%.1f", v)
      sub("[.]0$", "", s)
      printf "%s%s", s, suffix
    }
  }'
}

if [ -n "${context_tokens}" ]; then
  context_display=$(fmt_tokens "$context_tokens")
  session_display=$(fmt_tokens "${session_tokens:-0}")
  if [ -n "${window_size}" ] && [ "${window_size}" != "0" ]; then
    window_display=$(fmt_tokens "$window_size")
    used=$(awk -v n="$context_tokens" -v d="$window_size" 'BEGIN { printf "%.0f", (d > 0 ? n / d * 100 : 0) }')
    printf '%s | effort:%s | ctx:%s/%s (%s%%) | session:%s' \
      "$model" "$effort" "$context_display" "$window_display" "$used" "$session_display"
  elif [ -n "${used}" ]; then
    printf '%s | effort:%s | ctx:%s tokens (%.0f%% used) | session:%s' \
      "$model" "$effort" "$context_display" "$used" "$session_display"
  else
    printf '%s | effort:%s | ctx:%s | session:%s' \
      "$model" "$effort" "$context_display" "$session_display"
  fi
fi

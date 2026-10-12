# Fonts

`DraftyArgon-Var.woff2` and `DraftyNeon-Var.woff2` are modified versions of [Monaspace](https://monaspace.githubnext.com) Argon and Neon by GitHub Next, licensed under the SIL Open Font License 1.1 ([LICENSE-Monaspace.txt](LICENSE-Monaspace.txt)).

Changes from the originals, made with fontTools:

- Subset to the characters the app needs: Basic Latin, Latin-1 Supplement, Latin Extended-A, General Punctuation, Arrows, Geometric Shapes, and €, ™ and −.
- Width and slant axes fixed at their defaults (100 and 0); weight axis limited to 200–700.

Together they went from 1,051 kB to 129 kB. Because the license reserves the name "Monaspace" for unmodified fonts, the subsets are named "Drafty Argon" and "Drafty Neon", inside the files and in the CSS.

# GionCraft デモ

Googleドライブから取得した建物 CityGML データを元に、Three.js で自由移動できるシーンを生成するデモです。ブラウザ上でマインクラフト風の一人称視点操作を体験できます。#KGNINJA

## 構成

- `scripts/convert_gml_to_json.py` — CityGML の LoD1 サーフェスを抽出して Three.js 用の三角形メッシュ JSON を作成するスクリプト。
- `public/data/buildings.json` — 上記スクリプトで生成されるビル群のメッシュデータ。
- `web/` — Three.js を用いたブラウザ向けクライアント (HTML/CSS/JS)。

## 事前準備

1. `bldg-20250922T150041Z-1-001.zip` を `data/` フォルダに展開済みであることを確認します。 (`data/bldg/*.gml`)
2. Python 3.10+ がインストールされている環境を用意します。

## メッシュデータの生成

```bash
python3 scripts/convert_gml_to_json.py data/bldg public/data/buildings.json --limit 12
```

- `--limit` オプションで読み込む GML ファイル数を調整できます。値を大きくすると描画対象が増えますが、ファイルサイズとブラウザでの読み込み時間も増加します。

## デモの起動

静的ファイルを配信できれば任意の方法で構いません。Python の簡易サーバーを利用する場合は以下の通りです。

```bash
cd web
python3 -m http.server 8080
```

その後、ブラウザで `http://localhost:8080` を開きます。クリックしてポインタロックを有効にすると、WASD で移動、スペースでジャンプ、Shift でダッシュが可能です。

## 操作のヒント

- 建物が表示されない場合は、ブラウザの開発者ツールでコンソールログを確認してください。
- 建物数を増やしたい場合は `--limit` を変更して再度 `buildings.json` を生成します。
- 新しい GML データを追加した場合は、`scripts/convert_gml_to_json.py` を再実行して JSON を再生成してください。

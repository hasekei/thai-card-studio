# Thai Card Studio

タイ語の単語カードを画像とCSVで管理する、iPhone向けの静的PWAです。

## 使い方

- `CSV` タブから `thai,reading,meaning,category,memo` 形式のCSVを取り込み
- `カード` タブで各カードに画像を追加
- `復習` タブで画像から単語を思い出す

単語データや画像はブラウザ内に保存されます。GitHub Pagesに公開されるのはアプリ本体だけです。

## Firebase同期の設定

1. Firebase Consoleでプロジェクトを作成する
2. AuthenticationでGoogleログインを有効化する
3. Firestore Databaseを作成する
4. Authenticationの承認済みドメインに `hasekei.github.io` を追加する
5. Webアプリを追加して `firebaseConfig` をコピーする
6. アプリの `同期` タブに `firebaseConfig` を貼り付けて保存する
7. Googleでログインし、`今すぐ同期` を押す

Firestoreの最小ルール例:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/cards/{cardId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

画像はFirebase Storageではなく、圧縮したData URLとしてFirestoreへ保存します。大きすぎる画像は保存前に縮小されます。

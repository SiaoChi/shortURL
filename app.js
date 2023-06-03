const express = require('express')
const dotenv = require('dotenv')
const bodyParser = require('body-parser')

const app = express()
dotenv.config();


//以下為mongodb的設定
const { MongoClient } = require('mongodb');
const url = process.env.MONGODB_URL
const client = new MongoClient(url);
let db

// 檢查是否有連線
async function main() {
  await client.connect();
  console.log('Connected successfully to server');
  db = client.db('urls')
  console.log('connect to db urls');
  return 'done.';
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => console.log('run mongodb is running '));


// Shard the collection
const dbName = 'urls';

const shardCollection = async()=>{
  try{
    const adminDb= client.db('admin');
    await adminDb.command({ enableSharding: dbName });
    const db = client.db(dbName);
    const collection = db.collection('urls');


    /* 在Sharding中，當你設定shard key（分片鍵）時，你需要指定每個分片鍵的值。
    在你提供的程式碼中，key對象包含了三個分片鍵：prefix-1、prefix-2和prefix-3。
    值被設定為1，這代表在這些分片鍵上使用升序排列。(數字代表比重)
*/
    const result = await collection.createIndex(
      { "prefix-1": 1, "prefix-2": 1, "prefix-3": 1 },
      { name: "prefixIndex" }  //name可以根據自己的定義命名，不會對db有影響
    );

    await adminDb.command({
      shardCollection:`${dbName}.urls`,
      key: { "prefix-1": 1, "prefix-2": 1, "prefix-3": 1 }
    });
    console.log('Shard collection result:', result);
  }catch (err) {
    console.log('Shard collection error:', err);
  }
}

shardCollection();

//此function應該要替換成前村寫的function
function getShortUrl(originalUrl){
  const randomNum = Math.floor(Math.random()*3000 +1000)
  let new_url = `${randomNum}.com`
  return new_url
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', './views');


app.get('/',(req,res)=>{
  res.render('short-url')
})

app.post('/shorturl', async (req, res) => {
  console.log('req.body--->', req.body);
  const { originalUrl } = req.body;

  try {
    let shortUrl = getShortUrl(originalUrl);
    // console.log('---hit shorturl---' , shortUrl)

    const prefix = Number(shortUrl[0])

    const data = {
      [`prefix-${prefix}`]: prefix,
      originalUrl,
      shortUrl
    };

    const result = await db.collection('urls').insertOne(data);
    res.send({
      status:"success",
      message:'建立成功',
      url: shortUrl
    });

  } catch (err) {
    console.log(err);
    res.status(500).send('發生錯誤');
  }
})

app.get('/delete', (req, res) => {
  const result = db.collection('urls').deleteMany();
  if(result){
    return res.send('刪除成功')
  }
  res.send('失敗')
});


app.get('/:requestUrl', async (req, res) => {

  const { requestUrl } = req.params;

  try {
    const db = client.db('urls');
    const result = await db.collection('urls').findOne({ shortUrl: requestUrl });

    if (result) {
      const originalUrl = result.originalUrl;
      console.log('original URL: ', originalUrl)
      return res.status(200).redirect(originalUrl);

    } else {
      return res.status(404).send('URL not found')
    }

  } catch (err) {
    console.log('err', err);
    return res.status(500).send('Error retrieving URL')
  }

})


app.listen(3000, () => {
  console.log('server is listening  on port 3000')
})
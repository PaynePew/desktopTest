const express = require('express')
const path = require('path')
const mongoose = require('mongoose')
const ejsMate = require('ejs-mate')
const { campgroundSchema, reviewSchema } = require('./schemas')
const methodOverride = require('method-override')
const catchAsync = require('./utils/catchAsync')
const ExpressError = require('./utils/ExpressError')
const Campground = require('./models/campground')
const Review = require('./models/review')

mongoose.connect('mongodb://localhost:27017/yelp-camp', {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
})

const db = mongoose.connection
db.on("error", console.error.bind(console, "connection error:"))
db.once("open", () =>{
    console.log("Database connected")
})



const app = express()


app.engine('ejs', ejsMate)// 告訴ejs我們要使用ejsMate而不是default
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
mongoose.set('useFindAndModify', false);

app.use(express.urlencoded({extended: true}))
app.use(methodOverride('_method'))

// 宣告一個函數和joi的schema做認證，供後續使用
const validateCampground = (req, res, next) => {
    const {error} = campgroundSchema.validate(req.body)
    if(error){
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg , 400)
    } else {
        next()
    }
}

const validateReview = (req, res, next) => {
    const {error} = reviewSchema.validate(req.body)
    if(error){
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg , 400)
    } else {
        next()
    }
}

// 顯示localhost:3000的主頁面
app.get('/', (req, res) =>{
    res.render('home')
})

// 從MongoDB找出所有Campgound並在index.ejs顯示出來
app.get('/campgrounds', catchAsync(async (req, res) => {
    const campgrounds = await Campground.find({})
    res.render('campgrounds/index', {campgrounds})
}))

// new 在ID之前，否則new被視為ID
app.get('/campgrounds/new', (req, res) => {
    res.render('campgrounds/new')
})

// 接收主頁面的post，將新的req.body.campground資料存在database，並將頁面導向show.ejs的id
app.post('/campgrounds', validateCampground, catchAsync(async (req, res, next) => {
    // 如果接收的資料格式不符，會throw 一個ExpressError的instance，並給定message和status
    // if(!req.body.campground) throw new ExpressError('Invalid Campground Data', 400)
    const campground = Campground(req.body.campground)
    await campground.save()
    res.redirect(`/campgrounds/${campground._id}`)
}))

// 依據id去render show.ejs頁面
app.get('/campgrounds/:id', catchAsync( async(req, res) => {
    const campground = await Campground.findById(req.params.id).populate('review')
    console.log(campground)
    res.render('campgrounds/show', { campground })
}))
// 顯示edit頁面，從id去對比MongoDB的ID並把資料存起來給edit.ejs做render
app.get('/campgrounds/:id/edit', catchAsync(async(req, res) => {
    const campground = await Campground.findById(req.params.id)
    res.render('campgrounds/edit', { campground })
}))
// 接受id路徑的put資料，和資料庫對比後Update，並導回id的show detail頁面
app.put('/campgrounds/:id', catchAsync(async (req, res) => {
    const {id} = req.params
    const campground = await Campground.findByIdAndUpdate(id, {...req.body.campground})
    res.redirect(`/campgrounds/${campground._id}`)
}))

// 接收id路徑的delete，並使用MongoDB的findByIdAndDelete(id)刪除資料庫資料。 
app.delete('/campgrounds/:id', catchAsync(async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    res.redirect('/campgrounds')
}))
// 
app.post('/campgrounds/:id/reviews', validateReview, catchAsync(async(req, res) => {
    const campground = await Campground.findById(req.params.id)
    const review = new Review(req.body.review)
    campground.review.push(review)
    await review.save()
    await campground.save()
    res.redirect(`/campgrounds/${campground._id}`)
}))

app.delete('/campgrounds/:id/reviews/:reviewId', catchAsync(async(req, res) => {
    const { id, reviewId } = req.params
    await Campground.findByIdAndUpdate(id, { $pull: { reviews: reviewId }})
    await Review.findByIdAndDelete(req.params.reviewId)
    res.redirect(`/campgrounds/${id}`)
}))


// 順序很重要，只有在前面都沒有執行時才會執行這個all
app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404))
})

// 最後接受的next err，並顯示error頁面
app.use((err, req, res, next) => {
    const { statusCode = 500 } = err
    if (!err.message) err.message = 'Oh No, Something Went Wrong!!!'
    // 導向error.ejs
    res.status(statusCode).render('error', { err })
})



// app.get('/makecampground', async (req, res) => {
//     const camp = new Campground({title: 'My Backyard', description: 'cheap camping!'})
//     await camp.save()
//     res.send(camp)    
// })

app.listen(3000, () => {
    console.log('Serving on port 3000')
})
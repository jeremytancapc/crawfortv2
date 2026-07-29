import type { LangCode } from "./data";

export const I18N = {
en:{
  stepLabels:['Verify Identity','Loan Offer','Sign Agreement','Photo Capture','Disbursement','Complete'],
  s1:{
    heroTitle:'Welcome to Crawfort', heroSub:'Please choose your preferred language to begin',
    welcomeBack:'Welcome back,', chooseAction:'What would you like to do today?',
    loanTitle:'Loan Drawdown', loanDesc:'Collect your pre-approved loan in a few quick steps',
    start:'Get Started', proceed:'Proceed'
  },
  s2:{
    eyebrow:'Step 1 of 6', title:'Verify your identity with Singpass',
    desc:'Scan the QR code with your Singpass app',
    signin:'Sign in with Singpass', connecting:'Connecting to Singpass…', connectingSub:'Please do not close this screen',
    fetching:'Retrieving your Myinfo details…', fetchingSub:'This will only take a moment',
    myinfoTag:'Retrieved securely via Singpass Myinfo',
    p1title:'Personal Particulars', p1desc:'Verified against your NRIC',
    p2title:'Contact & Address', p2desc:'Your latest registered details',
    p3title:'Employment & Income', p3desc:'Used to confirm your loan eligibility',
    ackText:'I confirm the above information is correct',
    confirmContinue:'Confirm & Continue',
    fields1:{name:'Full Name',nric:'NRIC',dob:'Date of Birth',nationality:'Nationality',sex:'Sex'},
    fields2:{mobile:'Mobile Number',email:'Email Address',address:'Residential Address'},
    fields3:{occupation:'Occupation',employer:'Employer',income:'Monthly Income'}
  },
  s3:{
    eyebrow:'Step 2 of 6', title:'Checking your loan profile',
    checking:'Verifying your credit profile…', checkingSub:'Pulling latest MLCB / SCCB records',
    eligibleTitle:'Great news - you\'re eligible!', eligibleSub:'Your profile remains in good standing since your online application.',
    preApproved:'Approved Amount', tenure:'Tenure', tenureMonth:'Month', tenureMonths:'Months', monthly:'Est. Monthly Repayment',
    breakdownTitle:'Repayment Breakdown',
    principal:'Loan Principal', interest:'Total Interest (3.92% p.m.)', fee:'Processing Fee (10%, one-time)',
    monthlyInstalment:'Monthly Instalment', netDisbursedToday:'Net Amount Disbursed Today',
    netDisbursed:'Net Amount Disbursed', totalRepay:'Total Repayable',
    eligMsg:'You are eligible to proceed with drawdown of the loan plan above.',
    proceed:'Proceed to Drawdown'
  },
  s4:{
    eyebrow:'Step 3 of 6', title:'Review & sign your loan agreement',
    toolbarTitle:'Loan Contract Agreement',
    disclaimer:'Please read all terms and conditions carefully before signing.',
    callStaff:'Call for Staff', staffCalled:'Staff notified',
    staffModalTitle:'Need help with the contract?',
    staffModalBody:'This will call a staff member to assist you and explain the loan contract agreement in a language you understand.',
    staffModalCancel:'Cancel',
    desc:'Please read each page carefully before signing.',
    read:'Screen Reader', stop:'Stop Screen Reader',
    signHere:'Sign in the box below to accept this page', clear:'Clear',
    readAck:'I confirm I have read and understood this page',
    signedTag:'Done', signPage:'Sign & Continue', continueAll:'Continue',
    pages:[
      {title:'Loan Application - Particulars of Borrower', meta:'Moneylenders Act (Chapter 188) · Loan A/C No. 8018644C'},
      {title:'Note of Contract - Important Information & Terms and Conditions', meta:'Please read carefully - this will be explained to you in a language you understand'},
      {title:'Declarations - Loan Sum, Interest & Borrower Declarations', meta:'Please review and confirm each declaration'},
      {title:'Borrower\u2019s Consent for Release of Information', meta:'Please review before signing'},
      {title:'Cautionary Statement to Borrower', meta:'Issued by the Registrar of Moneylenders'},
      {title:'Insolvency-Related Consequences and Offences', meta:'Ministry of Law advisory'},
      {title:'Terms of Loan & Repayment Schedule', meta:'For your records'}
    ]
  },
  s5:{
    eyebrow:'Step 4 of 6', title:'Photo capture required',
    noticeTitle:'Mandatory under Singapore regulations',
    noticeBody:'As part of the loan drawdown process, a photograph of you is required for identity verification and record-keeping purposes, in accordance with regulatory requirements in Singapore.',
    ack:'I Understand, Proceed', ready:'Camera ready', getReady:'Please look at the camera',
    captured:'Photo captured successfully', retake:'Retake Photo', continue:'Continue'
  },
  s6:{
    eyebrow:'Step 5 of 6', title:'How would you like to receive your funds?',
    desc:'Choose a disbursement method below to complete your drawdown.',
    cashTitle:'Cash', cashDesc:'Collect your cash in person at our cash booth on this floor.',
    cashWarn:'Waiting time can be long - up to 30 minutes',
    paynowTitle:'PayNow', paynowBadge:'Recommended · Instant',
    paynowDesc:'Funds are transferred instantly to your NRIC-linked PayNow account.',
    paynowGood:'Registered to your NRIC - funds arrive instantly',
    confirm:'Confirm & Disburse'
  },
  s7:{
    thankTitle:'Thank you!', ref:'Loan ID',
    paynowMsg:'Your loan has been successfully disbursed via PayNow.\nPlease check your banking app.',
    cashMsg:'Please proceed to Booth 8 to collect your cash.\nEstimated waiting time is at least 30 minutes.',
    signoff:'Thank you for choosing', finish:'Done', restart:'Returning to the welcome screen…'
  },
  common:{back:'Back', next:'Next'}
},
zh:{
  stepLabels:['验证身份','贷款额度','签署合约','拍照留存','放款方式','完成'],
  s1:{
    heroTitle:'欢迎使用 Crawfort', heroSub:'请选择您偏好的语言以开始',
    welcomeBack:'欢迎回来，', chooseAction:'请选择您今天要办理的业务',
    loanTitle:'贷款提领', loanDesc:'只需几个简单步骤即可领取您的预批贷款',
    start:'开始办理', proceed:'继续'
  },
  s2:{
    eyebrow:'第 1 步，共 6 步', title:'使用 Singpass 验证您的身份',
    desc:'请使用 Singpass 应用扫描二维码',
    signin:'使用 Singpass 登录', connecting:'正在连接 Singpass…', connectingSub:'请勿关闭此屏幕',
    fetching:'正在获取您的 Myinfo 资料…', fetchingSub:'只需片刻',
    myinfoTag:'通过 Singpass Myinfo 安全获取',
    p1title:'个人资料', p1desc:'已根据您的身份证核实',
    p2title:'联系与住址', p2desc:'您最新登记的资料',
    p3title:'职业与收入', p3desc:'用于确认您的贷款资格',
    ackText:'我确认以上信息正确无误',
    confirmContinue:'确认并继续',
    fields1:{name:'姓名',nric:'身份证号',dob:'出生日期',nationality:'国籍',sex:'性别'},
    fields2:{mobile:'手机号码',email:'电子邮箱',address:'住宅地址'},
    fields3:{occupation:'职业',employer:'雇主',income:'月收入'}
  },
  s3:{
    eyebrow:'第 2 步，共 6 步', title:'正在核对您的贷款资料',
    checking:'正在核实您的信用状况…', checkingSub:'正在读取最新的 MLCB / SCCB 记录',
    eligibleTitle:'好消息 - 您符合资格！', eligibleSub:'自您在线申请以来，您的信用状况保持良好。',
    preApproved:'批准额度', tenure:'贷款期限', tenureMonth:'个月', tenureMonths:'个月', monthly:'预计每月还款额',
    breakdownTitle:'还款明细',
    principal:'贷款本金', interest:'总利息（月息 3.92%）', fee:'手续费（10%，一次性）',
    monthlyInstalment:'每月分期', netDisbursedToday:'今日实际到账金额',
    netDisbursed:'实际到账金额', totalRepay:'总还款额',
    eligMsg:'您已符合资格，可提领上述贷款方案。',
    proceed:'继续提领'
  },
  s4:{
    eyebrow:'第 3 步，共 6 步', title:'审阅并签署贷款合约',
    toolbarTitle:'贷款合约协议',
    disclaimer:'签署前请仔细阅读所有条款与细则。',
    callStaff:'呼叫职员', staffCalled:'已通知职员',
    staffModalTitle:'需要合约协助吗？',
    staffModalBody:'这将呼叫职员前来协助您，并以您理解的语言解释贷款合约协议。',
    staffModalCancel:'取消',
    desc:'签署前请仔细阅读每一页内容。',
    read:'屏幕朗读', stop:'停止屏幕朗读',
    signHere:'请在下方签署以确认本页内容', clear:'清除',
    readAck:'我确认已阅读并理解本页内容',
    signedTag:'已完成', signPage:'签署并继续', continueAll:'继续',
    pages:[
      {title:'贷款申请书 - 借款人资料', meta:'放债人法令（第188章）· 贷款账号 8018644C'},
      {title:'合约声明书 - 重要信息与条款细则', meta:'请仔细阅读 - 我们将以您理解的语言为您解释'},
      {title:'声明事项 - 贷款金额、利息及借款人声明', meta:'请检阅并确认以下各项声明'},
      {title:'借款人资料披露同意书', meta:'签署前请仔细阅读'},
      {title:'借款人警示声明', meta:'由放债人注册处发出'},
      {title:'破产相关后果及罪行', meta:'新加坡法律部咨询文件'},
      {title:'贷款条款与还款计划表', meta:'供您存档参考'}
    ]
  },
  s5:{
    eyebrow:'第 4 步，共 6 步', title:'需要进行拍照留存',
    noticeTitle:'依据新加坡法规强制要求',
    noticeBody:'根据新加坡相关法规要求，在贷款提领过程中需要为您拍摄照片，用于身份核实及存档目的。',
    ack:'我已了解，继续', ready:'相机已就绪', getReady:'请注视镜头',
    captured:'照片拍摄成功', retake:'重新拍摄', continue:'继续'
  },
  s6:{
    eyebrow:'第 5 步，共 6 步', title:'您希望以何种方式领取贷款？',
    desc:'请选择以下一种放款方式以完成提领。',
    cashTitle:'现金', cashDesc:'请到本楼层的现金柜台亲自领取现金。',
    cashWarn:'等候时间可能较长 - 最长可达 30 分钟',
    paynowTitle:'PayNow', paynowBadge:'推荐 · 即时到账',
    paynowDesc:'款项将即时转入您与身份证绑定的 PayNow 账户。',
    paynowGood:'已绑定您的身份证 - 资金即时到账',
    confirm:'确认并放款'
  },
  s7:{
    thankTitle:'感谢您！', ref:'贷款编号',
    paynowMsg:'您的贷款已成功通过 PayNow 放款。\n请查看您的银行应用程序。',
    cashMsg:'请前往 8 号柜台领取现金。\n预计等候时间至少 30 分钟。',
    signoff:'感谢您选择', finish:'完成', restart:'即将返回欢迎屏幕…'
  },
  common:{back:'上一步', next:'下一步'}
},
ta:{
  stepLabels:['அடையாள சரிபார்ப்பு','கடன் திட்டம்','ஒப்பந்தம்','புகைப்படம்','பணம் பெறுதல்','முடிந்தது'],
  s1:{
    heroTitle:'Crawfort-க்கு வரவேற்கிறோம்', heroSub:'தொடங்குவதற்கு உங்கள் விருப்ப மொழியைத் தேர்ந்தெடுக்கவும்',
    welcomeBack:'மீண்டும் வரவேற்கிறோம்,', chooseAction:'இன்று நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?',
    loanTitle:'கடன் பெறுதல்', loanDesc:'சில எளிய படிகளில் உங்கள் முன் அங்கீகரிக்கப்பட்ட கடனைப் பெறுங்கள்',
    start:'தொடங்குங்கள்', proceed:'தொடரவும்'
  },
  s2:{
    eyebrow:'படி 1 / 6', title:'Singpass மூலம் உங்கள் அடையாளத்தை சரிபார்க்கவும்',
    desc:'Singpass ஆப்பைப் பயன்படுத்தி QR குறியீட்டை ஸ்கேன் செய்யவும்',
    signin:'Singpass மூலம் உள்நுழைக', connecting:'Singpass உடன் இணைக்கிறது…', connectingSub:'இந்த திரையை மூடாதீர்கள்',
    fetching:'உங்கள் Myinfo விவரங்களை பெறுகிறது…', fetchingSub:'இது சிறிது நேரம் மட்டுமே ஆகும்',
    myinfoTag:'Singpass Myinfo மூலம் பாதுகாப்பாக பெறப்பட்டது',
    p1title:'தனிப்பட்ட விவரங்கள்', p1desc:'உங்கள் NRIC-உடன் சரிபார்க்கப்பட்டது',
    p2title:'தொடர்பு மற்றும் முகவரி', p2desc:'உங்கள் சமீபத்திய பதிவு செய்யப்பட்ட விவரங்கள்',
    p3title:'வேலை மற்றும் வருமானம்', p3desc:'உங்கள் கடன் தகுதியை உறுதிப்படுத்த பயன்படுத்தப்படுகிறது',
    ackText:'மேலே உள்ள தகவல் சரியானது என்று உறுதிப்படுத்துகிறேன்',
    confirmContinue:'உறுதிப்படுத்தி தொடரவும்',
    fields1:{name:'முழுப் பெயர்',nric:'NRIC',dob:'பிறந்த தேதி',nationality:'தேசியம்',sex:'பாலினம்'},
    fields2:{mobile:'கைபேசி எண்',email:'மின்னஞ்சல் முகவரி',address:'வதிவிட முகவரி'},
    fields3:{occupation:'தொழில்',employer:'முதலாளி',income:'மாத வருமானம்'}
  },
  s3:{
    eyebrow:'படி 2 / 6', title:'உங்கள் கடன் சுயவிவரத்தை சரிபார்க்கிறது',
    checking:'உங்கள் கடன் சுயவிவரத்தை சரிபார்க்கிறது…', checkingSub:'சமீபத்திய MLCB / SCCB பதிவுகளை பெறுகிறது',
    eligibleTitle:'நல்ல செய்தி - நீங்கள் தகுதியுடையவர்!', eligibleSub:'நீங்கள் ஆன்லைனில் விண்ணப்பித்ததிலிருந்து உங்கள் சுயவிவரம் நல்ல நிலையில் உள்ளது.',
    preApproved:'அங்கீகரிக்கப்பட்ட தொகை', tenure:'காலஅளவு', tenureMonth:'மாதம்', tenureMonths:'மாதங்கள்', monthly:'மதிப்பிடப்பட்ட மாத தவணை',
    breakdownTitle:'திருப்பிச் செலுத்தும் விவரம்',
    principal:'கடன் அசல்', interest:'மொத்த வட்டி (மாதம் 3.92%)', fee:'செயலாக்க கட்டணம் (10%, ஒருமுறை)',
    monthlyInstalment:'மாத தவணை', netDisbursedToday:'இன்று கிடைக்கும் நிகர தொகை',
    netDisbursed:'கிடைக்கும் நிகர தொகை', totalRepay:'மொத்தம் திருப்பிச் செலுத்த வேண்டியது',
    eligMsg:'மேலே உள்ள கடன் திட்டத்தை பெற நீங்கள் தகுதியுடையவர்.',
    proceed:'கடன் பெற தொடரவும்'
  },
  s4:{
    eyebrow:'படி 3 / 6', title:'உங்கள் கடன் ஒப்பந்தத்தை பரிசீலித்து கையொப்பமிடவும்',
    toolbarTitle:'கடன் ஒப்பந்தம்',
    disclaimer:'கையொப்பமிடுவதற்கு முன் அனைத்து விதிமுறைகளையும் கவனமாகப் படிக்கவும்.',
    callStaff:'பணியாளரை அழைக்கவும்', staffCalled:'பணியாளர் அறிவிக்கப்பட்டார்',
    staffModalTitle:'ஒப்பந்த உதவி வேண்டுமா?',
    staffModalBody:'இது ஒரு பணியாளரை அழைத்து, உங்களுக்குப் புரியும் மொழியில் கடன் ஒப்பந்தத்தை விளக்க உதவும்.',
    staffModalCancel:'ரத்து',
    desc:'கையொப்பமிடுவதற்கு முன் ஒவ்வொரு பக்கத்தையும் கவனமாகப் படிக்கவும்.',
    read:'திரை வாசிப்பான்', stop:'திரை வாசிப்பானை நிறுத்து',
    signHere:'இந்த பக்கத்தை ஏற்க கீழே கையொப்பமிடவும்', clear:'அழி',
    readAck:'இந்த பக்கத்தை படித்து புரிந்துகொண்டேன் என்று உறுதிப்படுத்துகிறேன்',
    signedTag:'முடிந்தது', signPage:'கையொப்பமிட்டு தொடரவும்', continueAll:'தொடரவும்',
    pages:[
      {title:'கடன் விண்ணப்பம் - கடன் பெறுபவரின் விவரங்கள்', meta:'பணக்கடன் வழங்குநர் சட்டம் (அத்தியாயம் 188) · கடன் கணக்கு எண் 8018644C'},
      {title:'ஒப்பந்த அறிவிப்பு - முக்கிய தகவல் மற்றும் விதிமுறைகள்', meta:'கவனமாகப் படிக்கவும் - உங்களுக்குப் புரியும் மொழியில் இது விளக்கப்படும்'},
      {title:'அறிவிப்புகள் - கடன் தொகை, வட்டி மற்றும் கடன் பெறுபவர் அறிவிப்புகள்', meta:'கீழே உள்ள ஒவ்வொரு அறிவிப்பையும் பரிசீலித்து உறுதிப்படுத்தவும்'},
      {title:'தகவல் வெளியீட்டிற்கான கடன் பெறுபவரின் ஒப்புதல்', meta:'கையொப்பமிடும் முன் பரிசீலிக்கவும்'},
      {title:'கடன் பெறுபவருக்கான எச்சரிக்கை அறிக்கை', meta:'பணக்கடன் வழங்குநர் பதிவாளரால் வெளியிடப்பட்டது'},
      {title:'திவால்நிலை தொடர்பான விளைவுகள் மற்றும் குற்றங்கள்', meta:'சட்ட அமைச்சக ஆலோசனை'},
      {title:'கடன் விதிமுறைகள் மற்றும் திருப்பிச் செலுத்தும் அட்டவணை', meta:'உங்கள் பதிவுகளுக்காக'}
    ]
  },
  s5:{
    eyebrow:'படி 4 / 6', title:'புகைப்படம் எடுக்க வேண்டியது அவசியம்',
    noticeTitle:'சிங்கப்பூர் ஒழுங்குமுறைகளின் கீழ் கட்டாயமானது',
    noticeBody:'கடன் பெறும் செயல்முறையின் ஒரு பகுதியாக, அடையாள சரிபார்ப்பு மற்றும் பதிவு நோக்கங்களுக்காக உங்கள் புகைப்படம் தேவைப்படுகிறது.',
    ack:'எனக்குப் புரிந்தது, தொடரவும்', ready:'கேமரா தயார்', getReady:'கேமராவைப் பார்க்கவும்',
    captured:'புகைப்படம் வெற்றிகரமாக எடுக்கப்பட்டது', retake:'மீண்டும் எடுக்கவும்', continue:'தொடரவும்'
  },
  s6:{
    eyebrow:'படி 5 / 6', title:'உங்கள் பணத்தை எவ்வாறு பெற விரும்புகிறீர்கள்?',
    desc:'கடன் பெறுதலை முடிக்க கீழே ஒரு பணம் வழங்கும் முறையைத் தேர்ந்தெடுக்கவும்.',
    cashTitle:'பணமாக', cashDesc:'இந்த மாடியில் உள்ள எங்கள் பண கவுன்டரில் நேரில் பணத்தைப் பெறவும்.',
    cashWarn:'காத்திருக்கும் நேரம் நீளமாக இருக்கலாம் - 30 நிமிடங்கள் வரை',
    paynowTitle:'PayNow', paynowBadge:'பரிந்துரைக்கப்படுகிறது · உடனடி',
    paynowDesc:'உங்கள் NRIC உடன் இணைக்கப்பட்ட PayNow கணக்கிற்கு உடனடியாக பணம் மாற்றப்படும்.',
    paynowGood:'உங்கள் NRIC உடன் பதிவு செய்யப்பட்டது - பணம் உடனடியாக வரும்',
    confirm:'உறுதிசெய்து பணம் பெறவும்'
  },
  s7:{
    thankTitle:'நன்றி!', ref:'கடன் அடையாளம்',
    paynowMsg:'உங்கள் கடன் PayNow மூலம் வெற்றிகரமாக வழங்கப்பட்டது.\nஉங்கள் வங்கி ஆப்பை சரிபார்க்கவும்.',
    cashMsg:'பணத்தைப் பெற 8-வது கவுன்டருக்குச் செல்லவும்.\nமதிப்பிடப்பட்ட காத்திருப்பு நேரம் குறைந்தது 30 நிமிடங்கள்.',
    signoff:'தேர்ந்தெடுத்ததற்கு நன்றி', finish:'முடிந்தது', restart:'வரவேற்பு திரைக்குத் திரும்புகிறது…'
  },
  common:{back:'பின்செல்', next:'அடுத்து'}
},
ms:{
  stepLabels:['Sahkan Identiti','Tawaran Pinjaman','Tandatangan','Ambil Gambar','Pengeluaran','Selesai'],
  s1:{
    heroTitle:'Selamat Datang ke Crawfort', heroSub:'Sila pilih bahasa pilihan anda untuk bermula',
    welcomeBack:'Selamat kembali,', chooseAction:'Apa yang anda ingin lakukan hari ini?',
    loanTitle:'Pengeluaran Pinjaman', loanDesc:'Dapatkan pinjaman pra-lulus anda dalam beberapa langkah mudah',
    start:'Mula', proceed:'Teruskan'
  },
  s2:{
    eyebrow:'Langkah 1 daripada 6', title:'Sahkan identiti anda dengan Singpass',
    desc:'Imbas kod QR menggunakan aplikasi Singpass anda',
    signin:'Log masuk dengan Singpass', connecting:'Menyambung ke Singpass…', connectingSub:'Sila jangan tutup skrin ini',
    fetching:'Mendapatkan butiran Myinfo anda…', fetchingSub:'Ini hanya mengambil masa sebentar',
    myinfoTag:'Diperoleh dengan selamat melalui Singpass Myinfo',
    p1title:'Butiran Peribadi', p1desc:'Disahkan mengikut NRIC anda',
    p2title:'Hubungan & Alamat', p2desc:'Butiran terkini yang anda daftarkan',
    p3title:'Pekerjaan & Pendapatan', p3desc:'Digunakan untuk mengesahkan kelayakan pinjaman anda',
    ackText:'Saya sahkan maklumat di atas adalah betul',
    confirmContinue:'Sahkan & Teruskan',
    fields1:{name:'Nama Penuh',nric:'NRIC',dob:'Tarikh Lahir',nationality:'Kewarganegaraan',sex:'Jantina'},
    fields2:{mobile:'Nombor Telefon Bimbit',email:'Alamat E-mel',address:'Alamat Kediaman'},
    fields3:{occupation:'Pekerjaan',employer:'Majikan',income:'Pendapatan Bulanan'}
  },
  s3:{
    eyebrow:'Langkah 2 daripada 6', title:'Menyemak profil pinjaman anda',
    checking:'Mengesahkan profil kredit anda…', checkingSub:'Mendapatkan rekod MLCB / SCCB terkini',
    eligibleTitle:'Berita baik - anda layak!', eligibleSub:'Profil anda kekal dalam keadaan baik sejak permohonan dalam talian anda.',
    preApproved:'Jumlah Diluluskan', tenure:'Tempoh', tenureMonth:'Bulan', tenureMonths:'Bulan', monthly:'Anggaran Bayaran Bulanan',
    breakdownTitle:'Pecahan Bayaran Balik',
    principal:'Prinsipal Pinjaman', interest:'Jumlah Faedah (3.92% sebulan)', fee:'Yuran Pemprosesan (10%, sekali sahaja)',
    monthlyInstalment:'Ansuran Bulanan', netDisbursedToday:'Jumlah Bersih Dikeluarkan Hari Ini',
    netDisbursed:'Jumlah Bersih Dikeluarkan', totalRepay:'Jumlah Perlu Dibayar Balik',
    eligMsg:'Anda layak untuk meneruskan pengeluaran pelan pinjaman di atas.',
    proceed:'Teruskan Pengeluaran'
  },
  s4:{
    eyebrow:'Langkah 3 daripada 6', title:'Semak & tandatangan perjanjian pinjaman anda',
    toolbarTitle:'Perjanjian Kontrak Pinjaman',
    disclaimer:'Sila baca semua terma dan syarat dengan teliti sebelum menandatangani.',
    callStaff:'Panggil Kakitangan', staffCalled:'Kakitangan dimaklumkan',
    staffModalTitle:'Perlukan bantuan dengan kontrak?',
    staffModalBody:'Ini akan memanggil kakitangan untuk membantu anda dan menerangkan perjanjian kontrak pinjaman dalam bahasa yang anda fahami.',
    staffModalCancel:'Batal',
    desc:'Sila baca setiap muka surat dengan teliti sebelum menandatangani.',
    read:'Pembaca Skrin', stop:'Berhenti Pembaca Skrin',
    signHere:'Tandatangan di dalam kotak di bawah untuk menerima muka surat ini', clear:'Kosongkan',
    readAck:'Saya sahkan telah membaca dan memahami muka surat ini',
    signedTag:'Selesai', signPage:'Tandatangan & Teruskan', continueAll:'Teruskan',
    pages:[
      {title:'Permohonan Pinjaman - Butiran Peminjam', meta:'Akta Pemberi Pinjaman Wang (Bab 188) · No. A/K Pinjaman 8018644C'},
      {title:'Nota Kontrak - Maklumat Penting & Terma dan Syarat', meta:'Sila baca dengan teliti - ini akan diterangkan kepada anda dalam bahasa yang anda fahami'},
      {title:'Perisytiharan - Jumlah Pinjaman, Faedah & Perisytiharan Peminjam', meta:'Sila semak dan sahkan setiap perisytiharan'},
      {title:'Persetujuan Peminjam untuk Pendedahan Maklumat', meta:'Sila semak sebelum menandatangani'},
      {title:'Kenyataan Amaran kepada Peminjam', meta:'Dikeluarkan oleh Pendaftar Pemberi Pinjaman Wang'},
      {title:'Akibat dan Kesalahan Berkaitan Insolvensi', meta:'Nasihat Kementerian Peguam Negara'},
      {title:'Terma Pinjaman & Jadual Bayaran Balik', meta:'Untuk rekod anda'}
    ]
  },
  s5:{
    eyebrow:'Langkah 4 daripada 6', title:'Pengambilan gambar diperlukan',
    noticeTitle:'Wajib mengikut peraturan Singapura',
    noticeBody:'Sebagai sebahagian daripada proses pengeluaran pinjaman, gambar anda diperlukan untuk tujuan pengesahan identiti dan penyimpanan rekod, selaras dengan keperluan pengawalseliaan di Singapura.',
    ack:'Saya Faham, Teruskan', ready:'Kamera sedia', getReady:'Sila pandang ke arah kamera',
    captured:'Gambar berjaya diambil', retake:'Ambil Semula', continue:'Teruskan'
  },
  s6:{
    eyebrow:'Langkah 5 daripada 6', title:'Bagaimana anda ingin menerima dana anda?',
    desc:'Pilih kaedah pengeluaran di bawah untuk melengkapkan pengeluaran anda.',
    cashTitle:'Tunai', cashDesc:'Kutip tunai anda secara peribadi di kaunter tunai kami di tingkat ini.',
    cashWarn:'Masa menunggu boleh mengambil masa panjang - sehingga 30 minit',
    paynowTitle:'PayNow', paynowBadge:'Disyorkan · Segera',
    paynowDesc:'Dana dipindahkan serta-merta ke akaun PayNow yang dipautkan dengan NRIC anda.',
    paynowGood:'Didaftarkan dengan NRIC anda - dana tiba serta-merta',
    confirm:'Sahkan & Keluarkan Dana'
  },
  s7:{
    thankTitle:'Terima kasih!', ref:'ID Pinjaman',
    paynowMsg:'Pinjaman anda telah berjaya dikeluarkan melalui PayNow.\nSila semak aplikasi perbankan anda.',
    cashMsg:'Sila ke Kaunter 8 untuk mengutip tunai anda.\nAnggaran masa menunggu sekurang-kurangnya 30 minit.',
    signoff:'Terima kasih kerana memilih', finish:'Selesai', restart:'Kembali ke skrin selamat datang…'
  },
  common:{back:'Kembali', next:'Seterusnya'}
},
} as const;

export type KioskCopy = (typeof I18N)[LangCode];

export function t(lang: LangCode): KioskCopy {
  return I18N[lang];
}


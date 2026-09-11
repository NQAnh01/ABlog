import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Locale = 'en' | 'vi'
type Params = Record<string, string | number>

const vi: Record<string, string> = {
  'nav.home':'Trang chủ','nav.explore':'Khám phá','nav.discussions':'Thảo luận','nav.myStories':'Bài viết của tôi','nav.dashboard':'Bảng điều khiển','nav.signUp':'Đăng ký','nav.signIn':'Đăng nhập','nav.signOut':'Đăng xuất','nav.newPost':'Bài viết mới','nav.saved':'Bài viết đã lưu','nav.todos':'Mục tiêu & việc cần làm','nav.settings':'Cài đặt tài khoản','nav.search':'Tìm kiếm trên Lumina',
  'theme.light':'Chuyển sang giao diện sáng','theme.dark':'Chuyển sang giao diện tối',
  'common.loading':'Đang tải…','common.loadingPage':'Đang tải trang…','common.error':'Đã xảy ra lỗi','common.empty':'Chưa có nội dung','common.emptyText':'Các bài viết mới sẽ xuất hiện tại đây.','common.previous':'← Trước','common.next':'Tiếp →','common.page':'Trang {page} / {pages}','common.retry':'Thử lại',
  'footer.description':'Một cộng đồng xuất bản hiện đại dành cho kỹ nghệ viết, những bài luận dài sâu sắc và góc nhìn độc lập.','footer.discover':'Khám phá','footer.explore':'Khám phá bài viết','footer.discussions':'Trao đổi cộng đồng','footer.readingList':'Danh sách đọc','footer.about':'Về chúng tôi','footer.privacy':'Chính sách riêng tư','footer.dispatch':'Các bài luận, ý tưởng sáng tạo và bình luận được tuyển chọn gửi đến bạn hằng tuần.','footer.join':'Tham gia','footer.subscribed':'✓ Đã đăng ký bản tin','footer.note':'Bản tin tuyển chọn mỗi Chủ nhật. Không thư rác.','footer.invalidEmail':'Vui lòng nhập địa chỉ email hợp lệ','footer.thanks':'Cảm ơn bạn đã đăng ký Lumina Dispatch!','footer.rights':'© 2026 Lumina Publishing Group. Bảo lưu mọi quyền.','footer.install':'Cài ứng dụng','footer.operational':'● Hệ thống hoạt động bình thường',
  'seo.description':'Khám phá những câu chuyện sâu sắc, ý tưởng hữu ích và góc nhìn mới từ các cây viết độc lập trên Lumina.','seo.explore':'Khám phá bài viết','seo.search':'Tìm kiếm bài viết','seo.about':'Về Lumina','seo.privacy':'Chính sách riêng tư','seo.discussions':'Thảo luận cộng đồng','seo.login':'Đăng nhập','seo.register':'Tạo tài khoản','seo.settings':'Cài đặt tài khoản','seo.notFound':'Không tìm thấy trang',
  'locale.label':'Ngôn ngữ','locale.en':'English','locale.vi':'Tiếng Việt',
  'notFound.kicker':'404 · KHÔNG TÌM THẤY TRANG','notFound.title':'Trang này đã đi lạc.','notFound.text':'Bài viết có thể đã được di chuyển, chuyển sang riêng tư hoặc chưa từng tồn tại.','notFound.home':'Về trang chủ','notFound.explore':'Khám phá bài viết →',
  'saved.kicker':'DANH SÁCH ĐỌC CỦA BẠN','saved.title':'Bài viết đã lưu','saved.text':'Những bài viết bạn đã đánh dấu để đọc sau.','saved.empty':'Chưa có bài viết nào được lưu','saved.emptyText':'Đánh dấu bài viết yêu thích và chúng sẽ xuất hiện tại đây.',
  'editor.allStories':'Tất cả bài viết','editor.editing':'ĐANG CHỈNH SỬA','editor.new':'BÀI VIẾT MỚI','editor.history':'Lịch sử phiên bản','editor.profilePin':'Ghim hồ sơ','editor.profilePinHint':'Ghim bài viết này trên trang tác giả công khai','editor.featured':'Nổi bật','editor.featuredHint':'Hiển thị bài viết này ở phần nổi bật trang chủ','editor.saving':'Đang lưu…','editor.offline':'Ngoại tuyến','editor.saved':'Đã lưu','editor.words':'{count} từ','editor.save':'Lưu bài viết','editor.title':'Tiêu đề bài viết','editor.titlePlaceholder':'Đặt một tiêu đề sâu sắc cho bài viết','editor.excerpt':'Tóm tắt','editor.excerptPlaceholder':'Một lời mời ngắn gọn dẫn vào câu chuyện…','editor.story':'Nội dung','editor.cover':'Ảnh bìa','editor.remove':'Xóa','editor.coverPreview':'Xem trước ảnh bìa','editor.uploading':'Đang tải lên…','editor.uploadCover':'Tải ảnh bìa','editor.imageRules':'JPEG, PNG hoặc WebP · tối đa 5 MB','editor.category':'Danh mục','editor.addCategory':'Thêm danh mục','editor.categoryPlaceholder':'Nhập tên rồi nhấn Enter','editor.visibility':'Quyền hiển thị','editor.private':'Riêng tư — chỉ bạn có thể xem','editor.public':'Công khai — mọi người đều có thể xem','editor.scheduled':'Lên lịch — xuất bản vào thời điểm tương lai','editor.publishAt':'Xuất bản lúc','editor.scheduleHint':'Bài viết sẽ tự động được công khai khi đến thời điểm này.','editor.richText':'Văn bản đa dạng','editor.markdown':'Markdown','editor.paragraph':'Đoạn văn','editor.heading1':'Tiêu đề 1','editor.heading2':'Tiêu đề 2','editor.heading3':'Tiêu đề 3','editor.loadingRich':'Đang tải trình soạn thảo…','editor.edit':'Chỉnh sửa','editor.split':'Chia đôi','editor.preview':'Xem trước','editor.emptyPreview':'Chưa có nội dung để xem trước.','editor.markdownPlaceholder':'Bắt đầu viết bằng Markdown…\n\n## Phần mới\n\nHãy kể câu chuyện thật rõ ràng.'
}

Object.assign(vi, {
  'editor.tags':'Thẻ','editor.manage':'Quản lý','editor.done':'Xong','editor.noTags':'Chưa chọn thẻ','editor.searchTag':'Tìm hoặc tạo thẻ…','editor.createTag':'Tạo “{name}”','editor.creatingTag':'Đang tạo “{name}”…','editor.pressEnter':'Nhấn Enter','editor.tagSelected':'Thẻ này đã được chọn.','editor.findTag':'Nhập để tìm thẻ.'
})

interface I18nValue { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string, fallback?: string, params?: Params) => string; formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string }
const Context = createContext<I18nValue | null>(null)
const interpolate = (value: string, params: Params = {}) => value.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => { const saved=localStorage.getItem('lumina-locale'); return saved==='en'||saved==='vi'?saved:navigator.language.toLowerCase().startsWith('vi')?'vi':'en' })
  useEffect(() => { localStorage.setItem('lumina-locale', locale); document.documentElement.lang=locale }, [locale])
  const value=useMemo<I18nValue>(()=>({locale,setLocale,t:(key,fallback=key,params)=>interpolate(locale==='vi'?(vi[key]??fallback):fallback,params),formatDate:(input,options={dateStyle:'medium'})=>new Intl.DateTimeFormat(locale==='vi'?'vi-VN':'en-US',options).format(new Date(input))}),[locale])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useI18n(){const value=useContext(Context);if(!value)throw new Error('useI18n must be used inside I18nProvider');return value}
const viContent:Record<string,string>={Design:'Thiết kế',Programming:'Lập trình',Technology:'Công nghệ','Soft Skills':'Kỹ năng mềm','Self Skills':'Kỹ năng bản thân'}
export function localizedContent(value:string,locale:Locale){return locale==='vi'?(viContent[value]??value):value}
export function LanguageSwitcher({compact=false}:{compact?:boolean}){
  const{locale,setLocale,t}=useI18n()
  const next=locale==='en'?'vi':'en'
  const label=locale==='en'?'Switch to Vietnamese':'Chuyển sang tiếng Anh'
  return <button
    className={`language-switcher${compact?' compact':''}`}
    type="button"
    role="switch"
    aria-checked={locale==='vi'}
    aria-label={label}
    title={label}
    onClick={()=>setLocale(next)}
  ><span className={locale==='en'?'active':''}>EN</span><span className={locale==='vi'?'active':''}>VI</span><small className="sr-only">{t('locale.label','Language')}</small></button>
}

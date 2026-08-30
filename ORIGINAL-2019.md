> Beyond Shape — the original write-up (Wolf Wikgren, Aalto University, 2019).
> Extracted verbatim from "Beyond shape, 24.1.2019.pdf"; formatting only, no paraphrase.
> This is the Reflector agent's principal context (AGENTS.md §2.6).


[The abstract should be one paragraph of between 150 and 250 words. It is not

indented. Section titles, such as the word Abstract above, are not considered headings

so they don’t use bold heading format. Instead, use the Section Title style. This style

automatically starts your section on a new page, so you don’t have to add page breaks.

To apply any text style in this document with just a tap, on the Home tab of the

ribbon, check out Styles.]

Keywords: [Tap here to add keywords.]



## Premise and process


The introductory chapter. Contemplation on the reasoning of this thesis and

the process applied throughout it. Introduction of the research question. A brief

overview of the critical view proposed as a method, and an outline of the rest of the

thesis.




## About data visualization, honesty and new forms


A driving thought of this thesis is the exploration of the relation between

expressive honesty and expressive power in data visualization. As data visualization

as field of study and a practice grows and matures, tools and practices are canonized,

and the boundaries of what is considered “good visualization” are increasingly defined

through the lens of a formalized view of data visualization practice. Current

development within data visualization is strongly bound to the development of ever

simpler and more powerful tools combined with a well-defined set of best practices

and research-based reasoning behind them1. This provides easy access to what can be

considered “good visualization” within this paradigm of development. Good templates

and examples enable visualization to be used as a tool where it would have been cost

prohibitive before, allowing non-expert users access to a mode of powerful

expression, essentially democratizing the process of creating typical visualizations.

This can be seen by the growth of the field and the increase in well-functioning


1 For instance, listen to the discussion about the future generation of

visualization tools with Andy Kirk at datastori.es (Kirk 2018)
visualizations of even complex data2. The potential downside to this is, that the

standardization of output invites practitioners to use output forms without much

critical thinking – relying on these standards even where they might not be applicable

or even to manipulate their data to make it fit the standard presentations. Even quite

eloquent and free-form tools are often technically confined to modes of well-

determined output components or fragments: maps, bars, lines, donuts, arrows, circles

and the like, all of which allow powerful expression of typical sets of data. The need

to questions these prevalent tools and modes comes into play when the data does not

conform to the mode of expression available or the expression available becomes too

convoluted for the audience. The complexity and sheer amount of information that

surrounds us as users in a world of increasing quantification can be overwhelming.

Here the proposal for a more critical design outlook onto visualization standards and

practices arises, in order to look beyond the expected modes, not to overthrow any

reigning ideology within the field, but to offer a look into other avenues to potentially

explore. This thesis is built around building a case for such a critical mode of

visualization for looking at a complex topic, through the research question:

Can a critical approach to the data visualization process produce a

design that is able to undermine oversimplification of complex data?




2 As discussed in the yearly review of popular data visualization podcast

datastori.es (Torban;Nussbaumer Knaflic ja Schwabish 2018)
Research and design as a form of critical practice

This thesis follows roughly along lines of methods and tactics associated with

critical and speculative design as presented by Matt Malpass3. Using design as a

medium for inquiry, it aims to be affective over being explanatory. In this manner

the goal is to encourage the audience toward critical thought in the hope of unearthing

new viewpoints on the subject matter. The aim is to diversify rather than simplify

understanding of the problem posed, in the terms of Mazé and Redström4. The

intended end result of the practical part of the thesis is a form of a post-optimal

object as imagined by Dunne, an object that moves beyond what is seen as an optimal

user experience toward user-unfriendliness in order to provoke5. Focus is placed on

the meaningful presence of the object created, shifting thought from creating an

optimized practical experience toward the communication of meaning. Moving

beyond the thoughts of the semantic turn within design – of optimizing an object

through the human perception of its affordances6 – toward an embrace of uncertainty,

interpretation and meaning in order to provide a view that is complementary to the

lines of thinking that are most prevalent7. Utilizing emerging technologies as a base

for the practical prototype, a speculative proposition is to be made about how these

3 In his Critical Design workbook Critical Design in Context: History,

Theory, and Practices (Malpass 2017)
4 “Perhaps a shared aim of critical design and design research is not

simplification but diversification of the ways in which we might understand design
problems, ideas, and boundaries.” (Mazé and Redström 2009)
5 If user friendliness is the crux for optimal objects, user-unfriendliness

defines an object as post-optimal. (Dunne 2005)
6 Krippendorf uses James J. Gibsons term affordance to describe the usability

of objects – the sit-ability of a chair for instance. (Krippendorff 2006)
7 (Malpass 2017)
technologies are materialized in the world outside of their local contexts of specialized

fields of science and engineering. The output of this proposed prototyped system uses

strategies of what Malpass calls non-rational design8. By designed ambiguity of

information of the relation between of the represented and its representation the aim

is to invite users both to make diverse interpretations and to react skeptically to the

output and the system itself9.

The thesis itself consists of four distinct parts. First, I explore the history and

current state of the field through the viewpoint of a practitioner, building a context for

this thesis within the it. This assessment of the field will provide basis for the

viewpoint of the practical visualization project of the thesis – grounding it in the

practice of data visualization and providing perspective for its critical outlook. It

portrays the mainstream data visualization field as a predominantly science and

engineering inspired one, with a focus on accuracy of data, efficiency in both form

and process. Alternative outlooks onto the field are then discussed in the context of the

mainstream.

Second, I present a view of the world surrounding the field, positioning it in

the larger context of society, exploring the ways the field of data visualization relates

to and can affect society around it. This presents the need to question some of the

dominant modes of information production, management and presentation. This

contextual positioning describes the emergence of a brief for the practical

visualization work of the thesis through research.


8 A term Malpass uses to describe methods presented by Gaver (Malpass

2017)
9 Ambiguity as a resource for design (Gaver, Beaver and Benford 2003)
Third, I present the practical production part of the research, describing each

part of the produced software machine and the reasoning behind them, binding back to

the first and second parts where necessary.

Fourth, the visualizations produced by the machine will be assessed through

a short user survey. This survey will focus on the ability of the visualization to portray

meaning and assess the honesty of the representation compared to the material

represented.

As an end note about the research presented: While presented in this report in

an ordered, chronological and separated manner, this thesis employs a research

through design outlook on design research, where the methods, practices and

processes of design practice employed in production of the practical design work

inform the theoretical research throughout the process10. This is employed in an

iterative manner, where ultimately theory and practical aspects are to some extent

inseparable: That is thing precedes theory, which precedes thing, which precedes

theory and so on. This iteration process can be roughly described as first

hypothesizing a feature or a function of the based on previous knowledge or research,

building the feature and then rationalize its position within both the system as a whole

and the base of theory and ultimately reflecting on whether the whole still is coherent

and the system more functional than before. If this is the case, then the built feature

and the rationalizing theory is included and internalized in the system and informs the

10 Inspired by the process described in the paper Research Through Design in

HCI (Zimmerman ja Forlizzi 2014)
next iteration. If not, the feature and associated theory is not included as such, but this

rejection certainly still informs the hypothesis of the next cycle.




Figure 1: Design process



Binding this formalization back to existing thoughts of design process, it

could be thought of as a work-specific application of the C-K-theory, where the design

process is seen as the expansion of a Concept-space of new ideas and a Knowledge-

space of validation11. Here the hypothesize phase exists within a Concept-space and

the build, rationalize and reflect phases occupy a Knowledge-space to validate the

hypothesized ideas.




## Context and position


Research into the context of the work created throughout the thesis process.

This research is not to be understood an exhaustive look onto the field of visualization

or the state of society, but something of a narrative and setting into which this thesis

proposes to position itself.




11 As expanded upon in C-K design theory: an advanced formulation

(Hatchuel and Weil 2009)

## State of the practice


The current state of data visualization practice is that of systems and

simplification. The simplification of graphics into sets of types, forms and

components, in order to build easily readable accurately communicating visual

representations through easy, automated systems, enabling an increased proliferation

of visualization in practical use.

Elijah Meeks eloquently reduces the current state of the practice to three

“waves” of history, of which the third is currently building. The first wave is that of

clarity: Borne out of statistics, this wave is exemplified by Edward Tufte’s trilogy of

books about the simplicity of charts and purity of expression of numerical data. The

second wave is that of systemization, where the ideas presented in the first wave have

been encoded into systems of visualization, that have then been programmed into

computer applications that automate the creation of visualizations that follow said

system. Meeks presents Leland Wilkinson’s ideas of systematization of graphical

forms – as presented in the book Grammar of Graphics – and their automation in

software form as something defining of this wave of visualization.12

Thinking beyond this simplification I follow along the lines in of this

declaration of waves, and this limitation of history seems useful to understand the

state of practice today. The first wave can be seen as an initial regularization of data

visualization practices. Prior to this, which Meeks also admits to, there is a rich history

12 Meeks presented has presented these thoughts both in a keynote speech at

Tapestry, a data storytelling conference (Meeks, Keynote at Tapestry 2018: Third
Wave Data Visualization 2018) as well as in writing for the Toward Data Science
-platform (Meeks, 3rd Wave Data Visualization: Understanding the convergence of
tools, audiences and modes 2018).
of forms and ways of visualization, but Tufte and his peers could be seen as a starting

point of the current practice and field of study, which highly values the clarity of

expression of numerical data in graphical form and often appreciates visual

minimalism: A statisticians view on data visualization. Other practitioners that could

be placed in the wave of clarity and statistical accuracy could be such names as

mathematician John Tukey with his use of computerized visualization in exploratory

data analysis13 and cartographer Jacques Bertin who pioneered a theory of meaning in

graphical forms used for visualizing data in his work Semiology of Graphics14.

The second wave could then be seen as the technological advancement of

principles set by the first. Practitioners and scholars between the waves would

progress the level of systematization of the practice toward what would become the

systemic concept of the grammar of graphics presented by Leland Wilkinson. William

S. Cleveland and Robert McGill undertook a scientific examination of graphical

perception relying on principles presented by the first wave through the lens of

psychophysics15. Jock D. MacKinlay described the building of automation to build

visualizations based on defined systems16, and Robert L. Harris had by 1996 gathered

a comprehensive reference list of visual tools and graph types17. Moving beyond the

field of computer science, Colin Ware takes a positivist approach through the lens of


13 As presented by Friedman and Stuetzle (Friedman and Stuetzle 2002).
14 (Bertin 1983)
15 (Cleveland and McGill 1984)
16 (MacKinlay 1986)
17 (Harris 1996)
perceptual psychology explains and justifies concepts of data visualization through a

universal model of human perception18.

Wilkinson’s Grammar of Graphics gathered aspects of these concepts into a

comprehensive and thorough syntax of visual representation – the specification of an

object-oriented graphics system as it is called in the book, the name a nod to its strong

footing within computer science. Abstracting charts into a more general grammar,

Wilkinson argues, gives more depth of expression by expanding the view of the

practitioner from a single chart type to universal graphics components. Ggplot2,

developed by Hadley Wickham, formalizes this grammar into an automated system in

the statistical modeling language R. Wickham and ggplot2 expand upon Wilkinson’s

grammar – developing an “alternative parameterization” as Wickham calls it – but still

relying on the same underlying visual principles19. Ggplot2 is by no means the only

library inspired by the formalization of visualization elements presented in Grammar

of Graphics. Meeks sees all current popular libraries of data visualization as to some

extent inspired by the concept of a grammar, building on top of the same principles,

accustoming the field for the use of system and optimizing the systems for use in the

field20.

18 (Ware 2004)
19 Wickham reconsiders Wilkinson’s intertwined elements as separated

layers, but the differences seem to be mainly mathematical (Wickham 2010).
20 (Meeks, 3rd Wave Data Visualization: Understanding the convergence of

tools, audiences and modes 2018)



## The Third Wave of data visualization


Moving back to Meeks’ thoughts on the current state of visualization, he

seems to argue that the forthcoming third wave of data visualization is about a shift in

focus. Shifting toward design tendencies from a focus on technologies and human

centeredness as opposed to absolute clarity or legibility, through a convergence of

tools for making, modes of making and audience expectations of visualization, into

new forms of visuals and ways of evaluating visualizations21. The emergence of the

field of user experience design since the emergence of the second wave would support

this kind of shift in thought toward optimizing the experience rather than the graph, as

understanding of user experience increases.

Ultimately Meeks’ argument seems to be about usefulness and usability –

aspects that are prevalent in other fields of software development – placing

importance on context of use as opposed to optimization of a single chart or even a

single system. Applied to the field of data visualization this could lead to a more

holistic, convergent way of thinking about visualization not as optimizable

presentations that are read by users but rather living data-representation structures that

are interpreted by humans. Meeks posits his third wave as a question: What will be the

determinant factors of the third wave as it breaks? I see this as a point where the

existing structures, systems and modes need to be questioned, through the critical use

of visualization in order to explore this suggested new convergent modality.


21 (Meeks, 3rd Wave Data Visualization: Understanding the convergence of

tools, audiences and modes 2018)
A too systems-optimized, performance oriented and reductionist second wave

view on data visualization can be highly restricting on expressive power and honesty.

Considering the definition of visualization – “the act or process of interpreting in

visual terms or of putting into visible form”22 – this a small subset of the entire scope

but has gained great prominence within the industry. Robert Kosara presents

visualization modes as a linear scale in his research on visualization criticism23.




The current state of the industry is firmly footed within the pragmatic

visualization end of this scale, optimizing for readability and recognizability. The

entire spectrum is much wider though, progressing toward less and less readable and

recognizable, on its way toward artistic visualization where these utilitarian

requirements are no longer present. In this other end, data functions as raw material

but the readability of information is not of as great concern as in the pragmatic

paradigm of visualization prevalent in the industry.

More artistic visualization might not be readable as such, but in eliminating

readability it has an opportunity to place importance on conveying understanding

rather than data itself. Through less readable and more sublime visualization – as

22 (Merriam-Webster 2019)
23 (Kosara 2007)
Kosara calls it in the vein of Manovich24 – it might then be possible to leave behind

the idea of truth in data and focus more on truth in meaning to the extent it is

necessary. What this means, is that it could give an opportunity to move away from a

visual display of quantitative to one of more qualitative information. Through this,

importance could then be placed on new aspects of the data presented, bringing

forward new insights. These kinds of pursuits within the visualization community

have been defined data or informative art, works of data visualization where data is

processed and presented in a free form manner and a singular interpretation is not

considered of importance25. In this sense, they are seen as something separate of

mainstream data visualization.

Elements of shifts in thought toward the more sublime, or at least

explorations of such repositioning, can be seen within the both visualization research

and in more mainstream practice. This re-evaluation of the relationship between the

data, its meaning and its representation could be a step toward better ways of

evaluating the validity and representational power of visualizations, and a place where

I position this work in the continuum of data visualization.




## Alternative approaches


Lev Manovich has published extensively on the topic of artistic visualization

and its relation to the history of contemporary visualization practice. In What is

Visualization? he discusses the topic in depth, presenting the practice of information


24 (Manovich, Data Visualization as New Abstraction and Anti-Sublime

2002)
25 (Koponen, Hildén and Vapaasalo 2016)
visualization as the reliance on principles of reduction and the use of spatial variables

as a representational tool. Manovich criticizes the prevalent mode of visualization

through presenting a model for non-reductive visualization he calls direct

visualization, presenting tag clouds and book indices as examples of such formats.

Direct visualization functions by not making reductions to the qualitative information

communicated, although it might reduce dimensions of the quantitative information

presented. As a “perfect example” of direct visualization principles applied to

visualization work, he mentions Listening Post by Mark Hansen and Ben Rubin, an

installation that presents unedited textual content scraped from internet discussion on a

grid of screens as well as spoken out loud by a speech synthesizer26. In this way, the

work does not manipulate the data it presents, while also rejecting existing paradigms

of form for visualizations, by taking the form of a custom-built installation.27

Giorgia Lupi speaks of the concept of data humanism as a potential new

paradigm for looking at both data and its presentations. Data humanism is a pursuit for

a more human approach toward presentation of data, often shifting digital data to

analog representation in its process. Lupi argues for a change from visualizing data

itself – the medium of information exchange in our world – toward visualizing the

meaning within or behind the data. A highlighted point is the human behind the data –

the idea that data is ultimately formed by human activity, and thus it should be

presented in a human way.28

26Video recording published by MediaArtTube is available on YouTube at

https://youtu.be/dD36IajCz6A (Hansen ja Rubin 2001)
27 (Manovich, What is visualisation? 2011)
28 Published both in Print Mag and Lupi’s personal blog

https://medium.com/@giorgialupi (Lupi 2017)
In the project Dear Data Lupi explores data humanism in practice together

with Stefanie Posavec. In the project, the two designers visualized aspects of their

everyday lives through hand drawn postcards. They set a framework of what kinds of

data to collect – pursuing types of data difficult to capture by computers – but leave

the form of visual representation freeform. This way they communicate through card

drawings throughout a year of data gathering and developing visual languages to fit

the often very unique and personal datasets.29

In this work the humanity behind the data is highlighted not only through the

hand drawn visualizations as well as the process to create them. The physical form of

a postcard records not only the data and its visual representation, but also the journey

of data transmission. Analogue drawings in this respect record more of the

visualization process than a digital representation would. In contrast to Manovich’s

idea of direct visualization the presentation of data in Dear Data is far from raw or

direct. The data is processed and reduced in manners effectively similar to those

common in mainstream practice of visualization, using spatial variables as a mode of

representation. Regardless, the project succeeds in criticizing the prevalent forms of

visualization through the ability to communicate qualitative information – the concept

of humans behind both the data and its representation. The hand-drawn aesthetic

mirrors effectively the hand procured nature of the data, communicating the fact that

this data was handled, processed. By shifting some of the accuracy of the numeric data

29 As well as the documentation Posavec has published on her website

(Posavec, Dear Data 2019) and a talk at Creative Mornings (Posavec, Stephanie
Posavec: Fragmented portraits in data & drawings 2016) a book, Dear Data, has also
been published on the subject, which was not acquired for reading to source this.
to fuzziness in representation, the work honestly informs the reader of its fallible

human origin.

Peter Hall approaches visualization through the lens of critical design. In his

essay Critical Visualization, he presents the idea of the art of visualization as critical

practice. He uses the exploration into the agency of mapping by James Corner as a

vehicle for thought, generalizing Corner’s ideas from one form of visualization – maps

– to encompass the general practice of visualization. Hall aligns the art of

visualization with the arts of urban planning and architecture as being able to modify

reality, not only concerned with the ultimate finished representation or product, but

also involved with the layers below: processing the data and setting the context from

which the representation is formed. Quoting Corner discussing Minard’s famous

visualization of Napoleon’s army in Russia30: “the map conditions how places on the

land have come to exist in new relationships precisely through the vector of an

event”31. That is, the visualization is able to affect how the physical places it

represents are considered through re-contextualizing them to a particular scenario.

This power gives visualization the ability to function as a critical practice, according

to Hall.32

In the paper Critical Visualization: a case for rethinking how we visualize

risk and security Hall, Heath and Coles-Kemp utilize the ideas of critical visualization

as a method of research in the context of the TREsPASS project – a European Union

30 A classic in data visualization, an image by the Charles Josepth Minard

that explores the diminishing of Napoleons troops through their Russian campaign.
Published for instance on Wikipedia: https://en.wikipedia.org/wiki/File:Minard.png
31 (Corner 1999)
32 (Hall, Critical Visualization 2008)
funded project concerned with predictive risk estimation and assessment (The

TREsPASS Project 2019), to assess the use of visualization within the cybersecurity

field. By analyzing the cultural context of both this field and the position of

visualization within it, they are able to highlight issues with the predominant mode of

visualization within cybersecurity. They recognize a disconnection between the

pursuit of usability and simplification within the predominant modes of data

visualization and the ever more complex field of cybersecurity, where modes of

implemented visualization perpetuate a dominant narrative of security as control. In

order to overcome this predominant narrative, the researchers approach visualization

interfaces through participatory research and physical modeling by visualizing the

networks of stakeholders and actions in LEGO. The group conclude to a view, that by

utilizing participatory data, the level of a secure enough system can be determined.

Data should be structured in a manner that a visual representation that is balanced

between simplicity and complexity can be attained. Strategy for interface design

should then be balanced between the representation of qualitative and quantitative

information through reassessing the evaluation criteria for visualization based on this

new balance, determined by the participatory research.33

The exploration by Hall et. al into visualization as a critical practice

highlights the importance of understanding context and effect of a visual

representation. Through a situation specific participatory approach to evaluation the

construction and development of a visualization can be approached in a very flexible,


33 (Hall, Heath and Coles-Kemp, Critical visualization: a case for rethinking

how we visualize risk and security 2015)
user oriented, manner. This seems to mirror arguments presented earlier for the third

wave of visualization, where modes, forms and user expectations ultimately would

converge.

These explorations of alternative modes and forms of visualization build a

position for criticism through practice within the field through rejecting, questioning

and scrutinizing the mainstream. Methods and tactics presented in the Approach and

process -chapter can be seen reflected in these works, providing precedence for their

use within the context data visualization. The ideas and projects Manovich presents

can be seen as aiming toward the diversification of thought by rejecting simplification

and meaningful presence through the focus on communicating qualitative information.

Lupi and Posavec seem to similarly follow a philosophy of meaningful presence

through humanization. The hand drawn presentations apply methods of information

ambiguity and form sorts of post-optimal objects by optimizing unique visual

representations for each set of data. Hall et al approach their subject by utilizing

design as inquiry through a participatory process, while in his own work Hall

produces a speculative proposition of how data visualization shapes the world. This

brief assessment then provides a base to think of the commonalities between these

projects as a starting point for new critical data visualization works.

## State of the surroundings





Figure 2: Bratton's Stack

Benjamin Bratton presents the idea of the Stack as a structural model of

contemporary society. The Stack describes the interconnected, convergent society of

technologies minds and matter – of planetary scale computation – as a platform

structured in layers. The Stack utilizes the software and hardware stack – the

interdependent parts of technology required to produce software – as metaphor for

what Bratton calls an “accidental megastructure” that is our societal landscape.34

Bratton’s work is related most to the societal level of the world, the political

geographies defining states and communities and the sovereignty of those entities. But

this computational rearrangement Bratton describes is both reliant and affective on the

systems and software within each stack layer, and as such it seems a relevant option to

consider as a starting point for societal context for the visualization work conducted

34 (Bratton, The Stack: On Software and Sovereignity 2015)
within this thesis. And if the Stack is considered a relevant model of the world, the

placement of a designed communication system within the Stack is relevant to

explore.

Data visualization as a concept lies strictly within the Interface layer of the

Stack, the part of the Stack, where the user connects to its lower layers. The

ubiquitous interface of our age – the two-dimensional graphical user interface – is

essentially a complex diagram, utilizing the same mechanisms of reduction and

readability as visualizations of data through diagrams35. As a user interacts with a

graphical user interface, their actions are replicated throughout the Stack to perform

the action afforded by the interface. This causes a ripple of effects within the Stack, as

the CPU is activated, as physical servers are accessed, as a mechanic is called upon to

fix the server infrastructure, as the factory produces an SSD drive, as silica dioxide is

mined from the earth while states fight over borders that contain the mine. This ability

to cause effects throughout the graphical user interface is the difference between the

user interface and a classic diagram.

The layers of the Stack are adjacent but disconnected, which leads to the

inevitability of mediated communication between layers. In this metaphor, the natural

media for communication between layers is data. Each stack has inputs for data,

processes it and outputs it somehow assessed or modified, and it is held together to the

layer above and layer below by data. Considering this gives data visualization as a

practice an interesting position within the interface layer, of being able to give form to


35 Especially about the Interface layer of the Stack in Bratton’s talk at the

Institute for the Humanities, starting around the 45:45 mark. (Bratton, The Stack:
Design and Geopolitics in the Age of Planetary-Scale computing 2014)
the connective tissue between the layers. Visualizing data gives us a view into how the

stack functions, even the layers far underneath the user layer we are helplessly stuck

on. While certainly not the only interface capable communicating the data in the in-

betweens, this does lead to a special kind of responsibility within the practice and

study of data visualization. This responsibility I feel is much represented in the current

pursuit of correctness and understandability within the field, its systems and the

practices these systems are built on. The prevailing concept of accuracy in

presentation of the data visualized – optimizing graphs for data – seems like it is the

embodiment of this responsibility. Practitioners in this pursuit of correctness seem to

often forget is that each layer of the Stack manipulates the data it outputs. The media

of data shifts, bends and warps as the layers shift, and data the itself is always meta,

about the layer but not the layer itself, and is often an unreliable mediator. This leads

to the contradiction of presenting unreliability or inaccuracy as accurately as possible,

to optimize away the option of less accurate representation. The question arises, of

how to assess these inaccuracies and visually represent them honestly rather than

accurately. This provides a conceptual base through which the practical visualization

work in this thesis is approached.




## User, Interface, Cloud, and Earth


Looking back at the progress within the field of visualization presented

earlier, a lot of it seems to be dealing with the optimization of representation of the

complexity of the real world. Much of the power of the tools and service we use,

comes out of being effective at abstracting the layers beneath the immediate interface.
Creating an opaque layer between users and understanding is then considered user-

friendliness, usability or good design in our age of increasing access to flows of

information. But regardless of making the complexity invisible is praised and

prevalent we are often overwhelmed.

James Bridle goes as far as calling the state of being a new dark age: “an age

in which the value we have placed upon knowledge is destroyed by the abundance of

that profitable commodity”36. While the situation might not be as dire as the title

makes it out to be, Bridle makes a statement of a worrisome future, one in which

people know more their surroundings than ever but are able to affect it less than

before. Bridle’s argument is not based on a particular topic, but rather a broad look

around the central question of how the world and emerging technology seems to

currently function. He positions his thinking as an argument against computational

thinking, which he describes as an extension to solutionism, a term popularized by

Evgeny Morozov37 as a pejorative for the belief in every problem being solvable by

the addition of technology. Bridle poses computational thinking as internalized

solutionism, a belief where it becomes impossible to be unable to represent the world

computationally, that he argues is a dominant way of thinking about our existence. As

an example of its limitations he presents the work by Lewis Fry Richardson, where

Richardson explored the lengths of borders in order to calculate likelihood of conflict

between countries. As Richardson would come to realize in his research, the

measurement of the length of a border is completely dependent on the level of


36 (Bridle, New Dark Age: Technology and the End of the Future 2018)
37 (Morozov 2014)
simplification of that border – this later bound into the canon of the study of fractals

by Benoît Mandelbrot. That is, the level of simplification controls our perception of

the world, acting as the opaque layer described in the beginning of the chapter. What

Bridle then argues for is literacy of systems and complexity. This literacy sets a

requirement for new metaphors and language that are able to better describe the

complexity of the systems on the layers below the representations.38

In his project Autonomous Trap 001, Bridle highlights his theory of systemic

literacy in the context of contemporary systems of automation. While working on a

self-driving car system – another project published as Austeer – the artist explored

potential ways of interaction with a system of automation. He then found a symbol

that both humans and the machine shared understanding of: The parallel of a solid line

and a dashed line, used to communicate the disallowing of crossing it from one

direction. This symbol can then be used to communicate between humans and the car

– in this project by encircling the car in a trap of virtual uncrossable barrier that for the

system is very real.39

This type of communication between system and humans is a key component

in helping people understand systems better and giving them a sense of agency over

even very complicated systems like artificial intelligence driven automated entities.

Development within field of Human-Computer Interaction is starting to address this

issue of control over seemingly black-box systems (Budiu 2018), but the languages

38 (Bridle, New Dark Age: Technology and the End of the Future 2018)
39 Bridle elaborates this project at the end of a talk at Eyebeam, from 1 hour 1

minute onward. (Bridle, Eyebeam: New Dark Age: Technology and the End of the
Future 2018)
and metaphors used to communicate the complexity of these systems to their users

will certainly still develop. This requires critical input from the designers and

developers of such systems not only on the representational layer, but also in critical

study and understanding of the processes that produce the data that is represented, a

nascent field in itself40.

Hito Steyerl writes about the deluge of data and its effects on our perception

of the world in the book Pattern Discrimination. She argues that apophenia – the

tendency to perceive meaningful connections of patterns between unrelated things

(Merriam-Webster 2019) – is replacing concepts of postmodern paranoia expressed by

Fredric Jameson. Where the paranoid imagination utilizes narrative plots and

delusions to fill in what it cannot comprehend of the complexity of its surroundings,

its apophenic counterpart stuffs these blanks by breaking down the paranoid narratives

into causalities backed up by data. Steyerl questions computational methods of pattern

recognition as potentially nothing more than modern apophenic devices, tools that

divine meaning out of the “truckload of data” presented to them. She examines

Google’s experiments in inceptionism41 – the reversal of pattern recognition neural

networks to instead produce images of what they have been trained to recognize – as a

way of seeing some of the underlying technological disposition: When random noise

is forced through a system taught to learn a particular thing, it will see that particular

40 Iliadis and Russo present Critical data studies as a field of research to

systematically and critically study data (Iliadis ja Russo 2016)
41 Term coined in the Google AI blog

https://ai.googleblog.com/2015/06/inceptionism-going-deeper-into-neural.html
thing within the noise – a computational take on Maslow’s hammer42. This binds to

her thoughts about the production of all this data – the fallibility of it, and the ways

this fallibility is dealt with through exclusion. As the data is gathered of humans,

about humans and processed by humans, it is bound to be an error-filled mess.

Highlighted by this is the difficulty of honesty in recognizing patterns within it

without disinfecting the dirt first, and thus possibly wiping out some of the humanity

of it. Steyerl has an ultimately optimistic call to action, an opposition to sifting and

filtering: “One might as well have fun with it”.43

Crawford and Joler approach one contemporary method of managing the

ever-increasing complexity of the data about our surroundings through their dissection

of an artificial intelligence system. They pick-apart the layers of technology behind

the opaque interface that is the Amazon Echo -device. Designed to optimize away our

daily contact with complexity, Crawford and Joler identify it doing so through a

problematic, fractalesque network of supply-chains, physical infrastructure and

exploitation on the physical layers of the world. In the digital realm, the software

requires quantification of nature and human behavior, fueling an aim of full

quantification through data extraction. Everything that can be captured is logged and

collected into datasets utilized for training and development of these systems in search

of the boundaries of the field. Invisible human work for classifying, tagging and

labeling through services like Amazon Mechanical Turk is employed to make maps

42 “I suppose it is tempting, if the only tool you have is a hammer, to treat

everything as if it were a nail.”, Maslow’s description of cognitive bias from his 1966
book, Psychology of Science.
43 (Steyerl 2018)
between captured data and human interpretation. In the push toward a potentially

infinite horizon of technology, as Crawford and Joler put it, this process of

quantification is applied to increasingly complex fields of human nature – emotions,

attention, reputation – and the software might become simply an amplifier of the most

popular interpretations of these fields.44




## The brief, distilled


If data visualization is a method for understanding our world – the earth layer

and how it communicates with the other layers of Bratton’s Stack – and visualization

has the power of affecting the state of that world as Hall arguments, then a good

subject for critical examination through visualization should be one of contemporary

concern about how our world is understood. Through the explorations of Steyerl and

Bridle about the state of the world, a concern about the sheer amount of information

and how it relates to our actual understanding of it – “it” referring to both the world

and the information – can be seen. As a topic this is directly bound back to the use of

data visualization, as data visualization is by definition bound to the production and

proliferation of data, making it a self-reflecting subject as well. A data visualization

design as a method of inquiry from the starting point of managing vast amounts of

data can then be used both to reflect upon the field and the information presented: It

should be able to diversify outlooks about modes of visualization and how those affect

our perception of the data presented through the creation of something post-optimal.


44 Published as part of the Artificially Intelligent display at Victoria and

Albert Museum and online at https://anatomyof.ai/ (Crawford and Joler 2018)
A more particular subject for examination can then be approached through

the writing of Crawford and Joler. As artificial intelligence systems are positioned as a

solution to creating understanding out of vast amounts of information, they are both a

potential tool and a point for critique. By using methods of teaching machines to

interpret human behavior, a machine which reinterprets these outputs back into

something more human can be speculated on. An example of a reducing way of

utilizing a machine learning system through human quantification is for example the

interpretation of human emotions. It is both an identified complex topic in machine

interpretation and the use of machine assisted interpretations of emotions is an

emerging topic within interface design45, making it an interesting avenue of

exploration from both the point of view of interface and cloud – and hopefully also

user and earth.



Reflecting this through the research question posed:

Can a critical approach to the data visualization process produce a design that

is able to undermine simplification of complex data?



The practical design brief then stands as: Design a speculative visualization

system, that is able to expand beyond machine interpretation of human emotions.




45As purported by Pamela Pavliscak in her book (Pavliscak, Emotionally

Intelligent Design 2018, Pavliscak, Emotionally Intelligent Design 2018) and a talk
given at WebExpo (Pavliscak, The future of AI is emotionally intelligent 2018)

## Proposition and application


Proposal and prototype-level implementation of an experimental

visualization system. An examination of the practical design work of the thesis from

concept to prototype. A description of inputs and outputs. A presentation of the

structure of the application produced and the documentation produced throughout the

process.




Figure 3: A concept image of the output of the Beyond shape -system




## Beyond shape


Beyond shape is an experimental visualization system, designed to quantify,

interpret and build visual representations of human emotions detected in media. It

aims to do so in a manner that does not take the accuracy of quantification as a given
and admits to possible shortcomings in the computer assisted analysis of

communication that it utilizes. Instead, the goal is to communicate not only the result

of the quantification process, but also the interpretational uncertainty within, in this

way hoping to build opportunities for new avenues of exploration within the field of

data visualization. Realizing the subjectivity of interpretation of a complex subject

like emotion, the system utilizes machine learning techniques in an attempt to undo, or

at least question, the methods of reduction employed by artificial intelligence systems

that interpret human actions. By creating a living, constantly rebuilding mapping of

visual attributes to emotional attributes, it attempts to capture this interpretational

subjectivity into a quantification of its own, asking whether a reduction of a reduction

can tell us something about the parts of its sum.

It is a machinery that consists of modular “serverless” parts – services that

abstract away physical servers – and is built mainly onto the cloud platform Zeit46.

The main machine consists of five parts: A Consumer for the input of data, a Decoder

for quantifying that data, an Interpreter for making recoding the data into other forms,

a Mapper that informs the Interpreter how to recode and a Constructor that pieces

together the data processed through the interpreter into visual representations. For this

prototype phase of the application a sixth, manual step of polishing the Constructor

output is applied, and referred to as the Renderer. Each part, its inputs, outputs and

functionality will be elaborated on in their own chapters.

46 https://zeit.co/now




Figure 4: Machine architecture




## Consumer


The Consumer takes input media and parses it into data to be processed by

other parts of the application. As such, it is not necessarily a separate part of

machinery, but a separate functionality which is required to get data into the machine.

In practice, its visual representation is the user interface that enables data entry. For

this prototype only a simple Consumer, suitable for testing purposes, was built as a

separate application. Also, within the scope of this thesis, a selection was made to

limit the format of input media to text, enabling its implementation through a simple

HTML textarea-element, not requiring a more complex interface. The functionalities

of the Consumer were also integrated into the decoder and the constructor to enable

rapid testing of the machine at different stages of the process. But conceptually it is a

separate functionality, and a part of future development could be to enable easier user


Figure 5: The visual manifestation of the Consumer within the Constructor: An HTML textarea.
participation in the process of creating visualizations by building a more robust

separate application for users to input to be processed by the system, as well as

enabling more types of media to be processed. The source code of the separate version

of the decoder can be found in GitHub47.




Figure 6: The separate Consumer used to test input and receive output about the Decoder
functionality.




## Decoder


The Decoder media parsed by the Consumer as input and outputs decoded

numeric data about that input. Conceptually the input media could be of any digitally

representable modality; technological capability exists to analyze at least video,

images, sound and text. But for the prototype produced within the scope of this thesis,

input media is limited to text. This text is then decoded into computational attributes

and numeric data through integrated third-party software systems. The systems used

47 https://github.com/KODHAGe/shape-consumer
are selected based on them being a part of analysis suites provided by large companies

established within the technology industry – with the thought that as this software is

provided by large companies it is more likely to have been implemented in production

use by others than more obscure or smaller platforms. That is, these analysis platforms

can be assumed to be common within their context, realistically being used for textual

analysis within popular software.

The function of the Decoder is to provide analysis about the emotionality of

the input. Thus, the second criterion for platform selection is that the software

provides some output indicating emotionality within text input, that is either sentiment

or emotion analysis. Ultimately three platforms, provided by Google, IBM and

Microsoft are selected for the prototype.



Google’s Cloud suite of tools provides a platform for natural language

analysis, called Cloud Natural Language. The platform provides analysis of grammar

and entity detection. The emotional analysis component Cloud Natural Language

provides is limited to detecting positive and negative sentiment, as well as sentiment

per object detected.48

Table 1: Google’s emotional attributes (reformat & move this)


Google Natural Language                                                    Attributes

Positive sentiment

Negative sentiment

48 (Google 2019)
Sentiment per detected entity



The IBM Cloud platform provides access to several language analysis

toolsets, the two of which identified as potentially interesting for the decoder being the

Watson Tone Analyzer, and the Watson Personality Insights services. While

Personality Insights provides an added range of emotional attributes as output, it is

designed for a large corpus of text content, and as this project at this stage would

function on the sentence to paragraph level, use was limited to the Tone Analyzer. The

Tone Analyzer provides emotion detection of seven attributes, presented in the table

below.49

Table 2: Watson emotional metrics (reformat & move this)


IBM Watson Tone Analyser                                                     Attributes

Anger

Fear

Joy

Sadness

Analytical

Confident

Tentative



49 (IBM, Personality Insights Documentation 2019) and (IBM, Tone

Analyzer Documentation 2019)
The Microsoft Azure -platform provides a similar set of natural language

analysis tools as the Google Cloud -platform, with entity, key phrase and sentiment

detection.50

Table 3: Azure emotional metrics (reformat & move this)


Microsoft Azure Text Analytics                                                Metrics

Positive sentiment

Negative sentiment

Sentiment per detected entity



It should be recognized that there are far more commercial platforms available for

emotion analysis than those presented and implemented in this thesis, as well as open

source projects and datasets that enable the running of a completely tailor-made

solution, and those options should be explored further when adding capabilities to the

platform. The selected systems all operate on a black box -basis, not informing the

user of reasoning of coming to a particular conclusion and in this way not elaborating

on how their functionality is produced – a developer needs to rely on the output given

being reasonable. All services are part of their respective company’s artificial

intelligence selection of services, so the assumption can be made they utilize at least

some machine learning principles instead of relying on completely dictionary-based

models of emotion detection. As can be seen from tables 1, 2, 3, the full set of

emotions for this prototype consists of 9 different variables: Anger, fear, joy, sadness,

50 (Microsoft 2019)
analytical, confident and tentative as assessed by the IBM Watson system, and

positive and negative that are retrieved from both Google and Microsoft. The positive

and negative values received from these systems can then be cross-referenced and

averaged to provide an insight into how this might affect the numbers provided – a

cross referencing of other emotion attributes could be added by other platforms if it

seems useful. The source code for this part of the application, as well as a cursory

technical documentation is available on GitHub51.




## Mapper





Figure 7: Conceptual model of the Mapper


The Mapper includes the functionality of the software machinery which feeds

an automated learning process with new data, enabling the Interpreter to learn about

51 https://github.com/KODHAGe/shape-decoder
the correlations between emotional and visual attributes. The Mapper provides a

crowd-sourced definition of the relation between emotional attributes and visual

attributes in order to enable mapping these together algorithmically in a way that

represents a potential common view of these combinations. Instead of relying on

pairings provided by existing research, the Mapper provides a living, forever changing

mapping by employing methods common to those used in machine learning. This

mapping does not directly rely on imposed interpretations of the designer as such, but

a view constructed out of the crowd. The imposing of a designed structure and

limitations – and thus the agency of the designer – is of course not removed, but it is

shifted toward the higher-level strategies utilized in the visualization and the specifics

of implementation rather than the immediate interpretation of data to representation.

The designer now shares some of their agency with the crowd by relinquishing part of

control but remains in control of the visualization structure through the selection of

attributes and control of the mapping process. Through this process, the limitations of

data collection methods common to the production of datasets utilized in machine

learning can be explored – effectively the Mapper creates a reduced model of a limited

range of interpretations.




## Defining visual variables


Before mapping can be enabled for the crowd, the mappable pairings need to

be defined. The input variables – that is, the emotional variables provided by the

Decoder – are to be mapped to visual representations. Here is where existing systems

of visualization come to play. Users are likely to be familiar with common forms of
visualizing data, and to reduce friction of use within the application, familiarity should

be seen as desirable. Different visualization systems were explored in order to collect

a set of variables that can be seen as common to represent data.

In Semiology of Graphics, Bertin pioneers a set of visual variables he calls

retinal variables that can be used to represent data in two-dimensional visualization.52

Table 4: Bertin’s visual variables (reformat & move this)

Bertin                                                                        Attributes
Shape
Orientation
Color (hue)
Texture
Value (brightness)
Size


This influential first wave formalization of visual variables has since been

assessed in the context of computerized data visualization by Sheelagh Carpendale

with identified modifications or additions to consider regarding the specifics of digital

displays and opportunities of 3D.53

Table 5: Carpendales amendments to Bertins variables (reformat & move this)

Carpendale                                                                    Attributes
Shape
Perspective
Hue
Saturation

52 (Bertin 1983)
53 (Carpendale 2003)
Value
Texture
Value
Size in three dimensions
Depth
Occlusion
Transparency
Motion


In the portion about aesthetics in Grammar of Graphics Wilkinson also builds on the

set established by Bertin, defining sub-attributes to greater specificity, and adding

some attributes discussed by other academics, but generally follows along the same

lines as originally presented by Bertin.54

Table 6: Leland Wilkinson’s visual attributes (reformat & move this)

Wilkinson                                                                  Attributes
Position
Size
Shape
Rotation
Resolution
Color (Brightness, Hue, Saturation)
Texture (Granularity, Pattern, Orientation)
Blur
Transparency
Motion
Sound
Text

54 (Wilkinson 2005)


Colin Ware, in his work Information Visualization: Perception for Design

goes further in his search for a combination of vision science and visualization,

tapping into research of preattentive processing for selection of visual attributes.55

Table 7: Colin Ware’s visual attributes (reformat & move this)

Ware                                                                         Attributes
Form (line orientation,
line length line width,
line collinearity,
size,
curvature,
spatial grouping,
blur,
added marks,
numerosity)

Color (hue,
intensity)

Motion (flicker,
direction of motion)

Spatial Position (2d position, stereoscopic depth,
convex/concave shape from shading)


Cheryl Akner-Koler devotes a paper to three-dimensional visual analysis in

sculpture. In this paper she assesses and explains a multitude of attributes usable in

visual analysis of three-dimensional objects from an aesthetics-oriented point of view,

which is often not the main focus of the more computer science-oriented views

presented. As Akner-Koler’s listing of attributes and features is very thorough, I’ve

55 (Ware 2004)
omitted displaying some of the sub-attributes in the list below in order to focus on the

top-level ones.56

Table 8: Akner-Koler’s visual attributes (reformat & move this)

Akner-Koler
Attributes
FOUR BASIC VISUAL ELEMENTS OF FORM AND SPACE
Volume
Plane
Line
Point
DIMENSIONS OF ELEMENTS
Height
Width
Point
PROPORTIONS
3-D PRIMARY GEOMETRIC FORMS
Curved
Straight
AXIS
CURVES
ORDER
Dominant
Subdominant
Subordinate
AXIAL RELATIONSHIPS
COMPARATIVE RELATIONSHIPS
JOINED FORMS
Intersectional forms
TRANSITIONAL FORMS
Divide
Adapt
Merge
Distort
FORCES in RELATIONSHIPS
EVOLUTION of FORM
3-D SPACIAL MATRIX
ORGANIZATIONAL FRAMEWORK
SYMMETRY and ASYMMETRY
BALANCE
ORIENTATION

56 (Akner-Koler 2007)
Direction
Position
Tip



Throughout the explored sets of visual variables there are clear commonalities. Akner-

Koler’s definitions as listed here appear most thorough, but this might simply be due

to the fact that she does not separate between features of objects and groups of objects

– the other researchers presented seemed to assess groupings and systems of objects as

separate subjects within their work, not directly relating to the object quality of

symbols used. This makes Akner-Koler’s approach interesting, as it is clearly distinct

those of the other researcher’s presented, while still retaining most of the top-level

attributes of shape, orientation, dimensions, just going in much deeper in detail in the

analysis of their contents. The object quality, or presence, of three-dimensional shapes

seem to be able to carry quite a bit more information than just two-dimensional shapes

based on the expression by Akner-Koler, compared to the analysis mainly focused on

2D shapes by the other researchers. While considered a perceptually difficult form to

convey details about abstract numbers in traditional data visualization57, a 3D shape

might be able to communicate more information but less accurately, which would fit

the goals of the system.

For mappable visual attributes, variables common to all research are first

selected: Shape, orientation and size, providing materiality to the shape. Akner-Koler

does not explore material as part of her visual analysis framework as it is concerned

with shape, but the other researchers include some form of color and texture, which


57 (Koponen, Hildén and Vapaasalo 2016)
are also included. Finally, all researchers who have considered the variables on digital

displays have included transparency and motion as variables, which are also chosen

for consideration.

These visual variables are then considered through the technical restrictions

imposed on the output. A couple of graphics programming frameworks are selected

based on familiarity with said frameworks: three.js, p5js, processing and

OpenFrameworks58. All frameworks support these common visual features pretty

much out-of-the-box, so no selected attribute needs to be discarded due to technical

impossibility. One rejection is still made through this technical analysis: Motion as an

attribute not as clearly defined as the others, and animation requiring more

programming work on the inspected frameworks than the other attributes, is discarded

for this initial prototype phase. Ultimately, the selection is then: Shape, orientation,

size, color, texture and transparency.




## Participatory mapping process


An interface is then built to enable participants to map an emotional attribute

to the presented set of visual attributes, by presenting them an emotional attribute and




Figure 8: Instructions and emotional attribute as presented in the Mapper.


58 https://threejs.org/, https://p5js.org/, https://processing.org/ and

https://openframeworks.cc/ respectively.
having them manipulate a shape to their subjective interpretation of that emotional

attribute. The emotional attribute is presented together with a short instruction of how

to operate the Mapper and a dictionary definition and a list of synonyms of the

attribute (a ref to table of attributes, dictionary definitions and synonyms?).



First the user selects a main shape. For this prototype, users are not enabled

to fully manipulate the forms, but a range of shapes are provided for the user to choose




Figure 9: Shapes available for user selection in the Mapper

from. The provided shapes are common 3D primitives – cone, cylinder, plane, toroid,

and spheroid – and Platonic solids – tetrahedron, cuboid, octahedron, dodecahedron,

and icosahedron.



Once a shape has been selected, the participant can modify the visual

variables available to that shape with sliders for each. The variables are deconstructed

out of the general set presented in the previous chapter to attributes that work for the

particular shape: Position is broken down to rotation on x-, y-, and z-axes, size

becomes width, height and length or a combination of those with radius or scale where

applicable. Color is broken down into hue and lightness, with value kept static to keep

color somewhat harmonious. Texture becomes gloss, as this was a simple attribute to

implement technically to give a sense of control of the roughness or “grain” of the

object as Bertin originally called it. Finally, transparency is controlled by an opacity

attribute to the color material of the object. Once the participant has completed the set
of mappings, the result will be stored with appropriate user metadata, in order to allow

further classification of the data. Partially filled sets are continuously saved in order to

minimize data loss, but these are separable from those filled to completion for the

dataset provided to the Interpreter. The output is a dataset of emotional variables

mapped to a set of visual variables.

As the aim is to explore the methods utilized in machine learning, the method

of participation is similar to one that could be imagined to be used in any machine

learning dataset gathering process, as described for instance in Callison-Burchs’ and

Dredze’s process for creating speech and language datasets59: Utilizing the micro-

work platform provided by Amazon, Mechanical Turk. Mechanical Turk – and other

similar crowdsourcing platforms such as Crowdflower – have quickly become an

essential part of not only machine learning processes, but the processes of

quantification in science. Their popularity in the research community has risen to the

extent that it has been called a “Golden age for survey research” in the JSTOR blog60.

While mired by ethical and social concerns about the low-pay and exploitational

dynamic between workers and employers in the service, there is an undoubted rise of

utilizing Mechanical Turk as an underlying platform which provides us the human

understanding that is relied upon in research. For instance, tracked the utilization of

Mechanical Turk as a research method in psychological research. By observing

empirical papers published in Journal of Personality and Social Psychology and

Personality, Social Psychology Bulletin and Psychological Science they saw a rise


59 (Callison-Burch and Dredze 2010)
60 (Samuel 2018)
from under 10% in all journals to near 45%, over 40% and almost 20% respectively of

papers published mentioning the platform as a resource between 2012 and 2015.61

For Mechanical Turk the Mapper needs to be broken down into what is called

Human Intelligence Tasks, or HITs on the platform. A HIT is any task you want a

worker to perform and is the completion of a HIT is the basis of payment for the

worker, paid when the employer – or requester in Mechanical Turk language – accepts

the result of the HIT. The simplest way to break down the Mapper into HITs, is to

present each emotional variable as a single task. A single variable Mapper HIT is thus

created for each emotional variable through the Mechanical Turk interface, which

allows an external interface to be embedded for use within the Mechanical Turk

system.




Figure 10: A single attribute HIT embedded in the Mechanical Turk platform




61 (Zhou and Fisbach 2016)
After first running a test of the survey outside the Mechanical Turk -platform,

it was then embedded as an outside source within the platform interface. As the survey

was embedded, a dual confirmation system was employed, where the worker would

first indicate the they finished the task by confirming their answer, before clicking the

Submit-button provided by the platform which marks the task done. In this way some




Figure 11: The double-confirmation system

of the surveys that were likely not filled completely can be discriminated when

processing the data.
The Turk workers were also provided a feedback field, to leave their

comments about the HIT. Perhaps surprisingly, quite a few of the workers left

feedback, although the field was optional. Some explained their reasoning for their

selection, some just commenting that they felt the survey was either good or weird or

offering constructive criticism and some reporting bugs they experienced with the

survey.




Figure 12: Feedback received through the Mechanical Turk -platform



An initial test run of 10 HITs per emotion was run to test the both the Mapper

and the Mechanical Turk platform for running it. As this testing round provided no

feedback about breaking bugs, the HITs were increased to 100 per emotional attribute

and ran again, resulting a total of 990 initial answers sourced from Mechanical Turk,
out of which 850 were marked completed. While relatively small, this dataset

functions as ground truth data for training a prediction model for shape attributes but

is expanded upon whenever anyone fills the mapper survey, which is also available

publicly outside the Mechanical Turk -platform for anyone with the link62. All the

source code for the application is also publicly available in its own repository on

GitHub63.




## Interpreter


The Interpreter is the part of the application within which the decoded input

from the Decoder is used to determine a set of encoded outputs by utilizing data from

the Mapper. It utilizes the dataset from the Mapper directly and is able to constantly

rebuild when as the dataset changes, always redefining the deterministic model of

interpretation it produces.




## Pre-processing


Pre-processing is the retrieving, filtering and sorting of a dataset to provide a

so-called clean version for that fits into whatever system used for further processing.

Cleaning data in this context means removing partially filled data and handling cases

of outliers. The Mapper provides a field which notes whether or not the user clicked

the confirm-button, which is used as the first step of processing to eliminate those

rows not deemed complete by their creator. This enables for instance easy elimination


62 https://shape-mapper.now.sh/
63 https://github.com/KODHAGe/shape-mapper
of test data that might have been accumulated in the dataset from previewing and

moving around sliders within the Mapper, as well as elimination of data by

Mechanical Turk users who might not have read the instructions clearly or simply

clicked the submit-button to claim the payment of the task. The second step is to

handle outliers. As this is a very small dataset on a very subjective topic, this is very

much massaging the dataset into a better fit, which should be addressed by gathering a

larger dataset for any true production version. As the end-result is a reduction of

opinions presented in the dataset, this is a way of strengthening the view of the

majority of answers and artificially creating stronger correlations – which can help

mask the quality of the dataset itself. Medians are calculated for each visual attribute

per each emotional attribute, and then a standard deviation calculation is used to

determine how much of the data will be seen as outliers. The rows with outliers could

then be entirely removed, but as the dataset provided by the Mapper is so small, and

each row has other data within it, the selection is made to instead clamp the outliers

into a maximum and minimum range of values determined by a bound multiplier to

the standard deviation calculation in the pre-processing stage. This means, a standard

deviation multiplied with the bound multiplier will be used to determine a maximum

and minimum value for every value in the dataset per emotional attribute. Any values

lower or higher than the bound will then be considered as equal to the maximum or

minimum value, essentially clamping the dataset. This reduces variance in the

resulting dataset, and highlights differences between emotional attributes if there are

any.




Figure 13: The dataset after clamping




## Modeling


As a part of the concept of the Machine as a black box, a neural network type

model is selected for building the statistical model that provides interpretations. In a

neural net algorithm, layers of computational neurons are fired of on a base set of data,

inspired by the function of neurons in a brain. Multiple layers of these neurons are

interconnected sequentially, with each connection being assigned a weight. These

weights determine the relationship between the output and the input of a net, and

modeling such a network is essentially manipulating the weights based on input data

until a suitable output is found 64.




Figure 14: Conceptual model of a neural network.


64 (Nielsen 2015)


The model is effectively automatically trying to form a function between

inputs x and outputs y, f(x) = y where f() is a complex function produced by the neural

network. By this function we are in this way able to map selected arbitrary inputs to

selected arbitrary outputs, with the performance determined by whether the

relationship between the two was viable to represent through a function in the first

place. Understanding of the input and output data helps and the importance of is

something that is highlighted as a necessity for creating a successful model by

professionals in the field65. But such understanding is not at all necessary for building

a functional model.

A multi-layer perceptron -type neural net is built in tensorflow.js by

following a tutorial for tensorflow.js66, a version of the Google built, Python based

Tensorflow machine learning framework built for JavaScript. As its inputs the

network takes emotion-answers from the mapper, where each emotion is dummy

variable encoded – the emotion selected for that particular answer is encoded as true

and all other emotions as false. Outputs are mapped to the visual attributes of the

mapper. As optimization of the network model, settings and data pre-processing is an

iterative process of running the network to analyze output, a simple output visualizer

is built to iteratively explore what the output of the network looks like in different

stages of the process. Initial tests are run with a single shape, a cuboid, and a single

emotional attribute, Anger, with varying amounts of training iterations.


65 For instance, see Peter Wardens blog (Warden 2018)
66 Originally a model for predicting baseball pitches (Kreeger 2019)




Figure 15: Variations of initial output of the Interpreter
When a satisfactorily visually specific form of Anger is formed, and the

network seems to start converging to a visually similar form of anger even if training

iterations are increased, Sadness and the combination of Anger and Sadness were

added to the visualized output. Soon after that also the calculation of shape was

implemented in the model. Looking at the results, shape selection seems to be quite




Figure 16: Sadness, Anger and Sad & Angry in Interpreter iteration 30
volatile for specific emotions even on a high level of iterations, but usually sticks to

shifting between a few shapes. As the shapes function as categories with no visual

interpolation available between them, this is an understandable result. As color,

orientation and size seem to stabilize in the visual representations it can be determined

that the learning process has concluded for that particular version of the Interpreter.

The tensorflow.js -platform is very flexible and has many so-called hyperparameter67

optimizations that can be made but won’t be elaborated on further within the written

part of this thesis. Testing version 30 of the model was split into a release version 1

and published on GitHub68, where all hyperparameters, preprocessing settings and

other configuration is available for viewing.




## Constructor


The Constructor builds visual representations of the determined by the

parameters of the Interpreter. It produces three-dimensional shapes viewable in a web

browser, based on text input which in this prototype version is entered into a

Consumer component within the constructor, that then sets in motion the Decode,

Interpret, Construct -process, that provides the final image.

67 A parameter that is set before the learning process begins
https://towardsdatascience.com/what-are-hyperparameters-and-how-to-tune-the-
hyperparameters-in-a-deep-neural-network-d0604917584a
68 https://github.com/KODHAGe/shape-interpreter

## Visual exploration





Figure 17: First drawn image of what would become the Constructor



The visual component of the Constructor is the first part of the application

that was concepted on, while not yet sure what its end goal or aim would be, as the

illustration of a poem on the back page of a notebook. Ultimately it evolved through

the process of research and development to become something completely different

than what originally suspected, but still providing a core of inspiration for the thesis

topic and visual concept. The original sketch is that of a jagged sculpturesque uncut

gemstone, with each facet concepted to present some aspect of the data that would

provide its structure when turned into a digital form. Here the three-dimensional

gemstone form would provide ambiguity in the information presented, in this way

challenging its reader to interpret more into and out of the image, the concept being
this would become a slightly user-unfriendly but still to some extent legible

representation of data. The embodiment of the data into a form that reminds of the

physical could give the data a different presence than a traditional visualization,

numbers giving way for meaning, but with the shapes still being learnable and

discernable from each other providing some readability, binding the visual concept

strongly to the critical design approach proposed.

This approach was then pursued by some research into crystalline forms both

as visual inspiration and to determine whether such forms would be technically

feasible to produce for the prototype version of the visualization. Pentti Eskola

elaborates on the formation and structure of crystals in his popular science book from

the 1940’s Atomit ja kiteet. He describes how crystalline structures are formed

through combinations of smaller particles that are aligned into regular forms, and

those regular forms growing into and out of other such regular forms. He describes the

processes and structures through simple illustrations of different crystal forms and

structures, that form a starting point for visual exploration of structures formed out of

more simple geometric shapes.69

An approach of exploring how crystalline structures function mathematically

is considered, but ultimately discarded due to the complexity of producing a

visualization that would accurately follow the formation of crystalline structures. But

further exploration of crystalline structure formation for a more elaborate placement

functionality in the Constructor could prove useful for future development.


69 One of the more precious thrift-store finds throughout the process of this

thesis. (Eskola 1948)




Figure 18: Picture of a staurolite crystal70




Figure 19: Image of a group of baryte crystals71


70 Page 19 (Eskola 1948)
71 Page 27 (Eskola 1948)




Figure 20: A group of apatite crystals72



Markus Rissanen examines the forms and their incidence and

representational attributes in visual culture, binding them to the concept of basic

forms: The square, circle and triangle. Rissanen divides forms into two modes,

perceptual and conceptual. The perceptual forms are those attempting and succeeding

to mimic patterns that occur in nature – how nature looks to the eye – while

conceptual forms are human interpreted abstractions of such forms – how nature

works under the hood. He explores how the basic forms, while conceptual as such, can

be used to form complex structures and patterns that present imagined perceptual

forms, sometimes even inspiring new scientific findings of such forms, such as

Penrose tiling preceding the finding of quasicrystals in nature.73

Rissanen’s research inspires to take things back a from a modeling of

crystalline structure in itself, but to rather consider what they are – collections of

72 Page 30 (Eskola 1948)
73 (Rissanen 2017)
three-dimensional basic shapes that collectively form structures which appear as

crystalline, as visible also from the images in Eskola’s work. A separation into

modeling separate shapes, not an entire structure simplifies the technical aspect of data

mapping – instead of mapping data into an incredibly complex mesh, each piece of

data can be mapped into a separate shape, while the entirety will still hold all

complexity by combining these shapes into a whole.




Figure 21: A sketchbook drawing of potential Constructor output




## Prototype


The prototype was built using Aframe74, a virtual reality ready 3D-framework

for web browsers. The selection was made in part due to existing capabilities cutting

down development time, as well as an interest to try out augmented reality features to

74 https://aframe.io/
give the visualized shapes a further embodied feeling. Ultimately the AR-features of

Aframe, while available through experimental WebXR75 features or an external library,

are currently in a very raw state as the focus has been on VR-features. But as the

WebXR standard matures, and support moves to that standard, AR-features will

hopefully improve.

The functionality of the Constructor-prototype is rather simple compared to

the Decoder and Interpreter: It is a presentation layer for Interpreter output data. The

visual encoding comes out of the Interpreter and can be used pretty much as is to

create a shape that corresponds to that encoding. These shapes are then placed in the




Figure 22: A matrix of emotion attributes and interpolations between them
directly from the Constructor.


75 A W3 standard to replace WebVR that provides better support for all

immersive realities
scene in a chronological order, where the emotional closeness of adjacent shapes is

taken into account by placing emotionally similar objects closer or even overlapping

each other. A user can input media through the consumer-component, which will

automatically trigger the entire machine cycle, presenting the user with a constructed

object of the media they input.

The source code for the Constructor is available in its own repository on GitHub76.


## Renderer


The renderer concludes the visualization process through a finishing step

producing the build representations through a physical simulation. This is included as

a part of the prototype while not an integral part of the machine, as it is a manual step

to quickly polish visualizations produced by the Constructor for viewing. The renders

are produced out of exports from the Constructor imported into Blender77. The

Blender imported figure retains the visual attributes of the Constructor model, but

allows for more complex illumination and perspective control, through which better




76 https://github.com/KODHAGe/shape-constructor
77 3D-graphics software, https://en.blender.org/
images of the scenes can be constructed, improving the material quality of the

visualizations. The blender scenes and rendered images are available for viewing and

download via GitHub78.

Figure 23: First rendered test shape-structure


78 https://github.com/KODHAGe/shape-renders




Figure 24: A rendered image of a matrix of all feelings and combinations, with some visual
error that occluded parts of the matrix.



## Conclusion



## Validation


A human assessment of the produced renders is organized in order to provide

an answer to the posed research question. While the system itself ending at the

Constructor is dynamic and not dependent on the input, the ultimate renders are based

on a set of pre-determined content processed through the Renderer. The input content

is a selection of six short pieces of text selected a from larger set of sources that have

been interesting to me throughout my studies at the Media Lab, to bind this thesis

back to its roots in a sense. The sources are picked to represent multiple textual types:

fiction, non-fiction and poetry and can be seen in appendix 1 (user test sheet). The

selected texts were not used to test the system during development, to avoid over-

optimization for specific texts and to give a view of how the system functions for

arbitrary content.

Testers are given a form to assess 3 visualizations grading them on a scale of

0–1 for each of the emotional attributes used in the prototype, with a separate

'certainty' value for each. This is complemented by an open-ended question that allows

testers to elaborate on how they read a particular visualization. After assessing the

visualizations, each participant makes a similar assessment of 3 of the source texts.

The source texts assessed by a person are selected to be different than the

visualizations assessed by the same person, so as to try and avoid the visualizations

affecting the assessment of the sources. This produces a dataset with three

interpretations on the same subject: The emotional attributes that the Decoder detects
in the text, a human interpretation of the text and a human interpretation of the

visualization. These are then compared to provide insight into how the interpretations

change from phase to phase.

These questions are asked in order to reflect the end-result in the light of the

both the original research question as well as the design brief derived from it.



The initial goal is set to gathering five responses to each text and each image,

to start seeing whether the differences described above start appearing. The aim is not

to provide conclusive evidence, but to gather viewpoints for future discussion of and

around the topic.




## Implementation


The goal of 5 results for each of the visualizations and texts where no

participant answers to both the text and the visualization of the same text, sets the

requirement of gathering 10 participants in order to gather 60 answers in total. As the

project as this stage can be seen as a pilot test, with no goal of reaching conclusive

evidence, convenience sampling is used to gather test participants. The tests were held

in person, as opposed to using online or crowd sourced methods that are applied in the

application.




## Result


Results and conclusion of the test.

## Assessment


Assessment of the visualization is done through determining success in

answering the research question posed and fulfilling the design brief derived from that

research question:

Can a critical approach to the data visualization process produce a design

that is able to undermine simplification of complex data?

And

Design a speculative visualization system, that is able to expand beyond

machine interpretation of human emotions.



Through the data gathered from the user tests, three questions can be posed to provide

views on what kind of effect the Beyond Shape visualization might have:

Is there a difference between how humans interpreted the text compared to

the Decoders interpretation? How valid are the machine interpretations of the text?



Is there a difference between how humans interpreted the text and how they

interpreted the visualization? Did the visualization succeed in conveying the

information in the text while increasing the uncertainty of interpretations?



Is there a difference between how humans interpreted the visualization and

how the Decoder interpreted the text? Did the visualizations add uncertainty and

variance to the human interpretation, compared to simply reading the direct

quantification, while still being valid visualizations of that data?


Steps to take it further:

At least: More input types, more immediate output. Further development of

the ML-part.




## Avenues explored but unpresented


Beyond conclusions and direct steps, there is a body of research that has been

considered or has even inspired some of the end-result in a non-trivial way but has

been excluded from this thesis due to time, narrative or relevance reasons. I have

collected here some of these topics, people and avenues of exploration that I wish to

acknowledge as important to the subject, but that I’ve had to knowingly omit:

Academic research into uncertainty visualization, Critical Fabulations by

Daniela Rosner 79, generative art and its relation to data visualization or data art, the

emerging field of artificial intelligence art and artists like Gene Kogan80 or AICAN81,

Jentery Sayers’ list of things to consider Before You Make a Thing82, and the entire

course materials of Prototyping Pasts + Futures83, the book and concept of Datafied

Society84, Xenographics85 as a form of artistic visualization, the SciArt-community86

and that brand of looking at the combination of science and art, data sculptures as an


79 https://mitpress.mit.edu/books/critical-fabulations
80 http://genekogan.com/
81 https://www.aican.io/
82 https://jentery.github.io/ts200v2/notes.html
83 https://jentery.github.io/ts200v2/
84 http://www.oapen.org/search?identifier=624771
85 https://xeno.graphics/
86 https://www.sciartmagazine.com/
artform87, the latest developments in combining machine learning and data

visualization published by Benoît Frénay88, Critical Theory and Interaction Design by

Bardzell, Bardzell and Blythe89, Visual Complexity: Mapping Patterns of Information

by Manuel Lima90.




87 http://dataphys.org/list/tag/data-sculpture/
88 https://bfrenay.wordpress.com/visualisation-and-interpretation-in-ml/
89 https://mitpress.mit.edu/books/critical-theory-and-interaction-design
90 http://www.visualcomplexity.com/vc/book/

## Bibliography


Akner-Koler, Cheryl. 2007. "Three-dimensional Visual Analysis." In Form &

Formlessness: Questioning Aesthetic Abstractions through Art Projects,

Cross-disciplinary Studies and Product Design Education, by Cheryl Akner-

Koler, 95-165. Stockholm: Axl Books.

Bertin, Jacques. 1983. Semiology of Graphics. Redlands, California: Esri Press.

Bratton, Benjamin. 2014. The Stack: Design and Geopolitics in the Age of Planetary-

Scale computing. October 29.

https://www.youtube.com/watch?v=IXan6TvMqgk.

—. 2015. The Stack: On Software and Sovereignity. Cambridge, London: The MIT

Press.

Bridle, James, interview by Surya Mattu. 2018. Eyebeam: New Dark Age: Technology

and the End of the Future (October 4).

—. 2018. New Dark Age: Technology and the End of the Future. London: Verso.

Budiu, Raluca. 2018. Can Users Control and Understand a UI Driven by Machine

Learning? December 16. https://www.nngroup.com/articles/machine-

learning-ux/.

Callison-Burch, Chris, and Mark Dredze. 2010. "Creating Speech and Language Data

With Amazon’s Mechanical Turk." Proceeding CSLDAMT '10 Proceedings

of the NAACL HLT 2010 Workshop on Creating Speech and Language Data

with Amazon's Mechanical Turk. Los Angeles, California: Association for

Computational Linguistics. 1–12.
Carpendale, M.S.T. 2003. Considering Visual Variables as a Basis for Information

Visualisation. Calgary: University of Calgary.

Cleveland, William S., and Robert McGill. 1984. "Graphical Perception: Theory,

Experimentation, and Application to the Development of Graphical

Methods." Journal of the American Statistical Association 79 (387): 531-554.

Corner, James. 1999. "The Agency of Mapping: Speculation, Critique and Invention."

In Mappings, by Denis Cosgrove, 213–252. London: Reaktion Books .

Crawford, Kate, and Vladan Joler. 2018. Anatomy of an AI System. November 11.

https://anatomyof.ai/.

Dunne, Anthony. 2005. Hertzian Tales: Electronic Products, Aesthetic Experience,

and Critical Design. Cambridge, London: The MIT Press.

Eskola, Pentti. 1948. Atomit ja Kiteet. Helsinki: Tammi.

Friedman, Jerome H., and Werner Stuetzle. 2002. "John W. Tukey's Work on

Interactive Graphics." The Annals of Statistics, December: 1629–1639.

Gaver, William W, Jacob Beaver, and Steve Benford. 2003. "Ambiguity as a Resource

for Design." CHI '03 Proceedings of the SIGCHI Conference on Human

Factors in Computing Systems. New York: ACM. 233-240.

Google. 2019. Cloud Natural Language Documentation. 1 3.

https://cloud.google.com/natural-language/overview/docs/.

Hall, Peter. 2008. "Critical Visualization." In Design and the Elastic Mind, by edited

by Paola Antonelli, 122-131. New York: Museum of Modern Art.
Hall, Peter, Claude Heath, and Lizzie Coles-Kemp. 2015. "Critical visualization: a

case for rethinking how we visualize risk and security." Journal of

Cybersecurity 1 (1): 93–108.

Hansen, Mark, and Ben Rubin. 2001. Listening Post.

https://www.youtube.com/watch?v=dD36IajCz6A.

Harris, Robert L. 1996. Information Graphics: A Comprehensive Illustrated

Reference. Oxford: Oxford University Press.

Hatchuel, Armand, and Benoit Weil. 2009. "C-K design theory: an advanced

formulation." Research in Engineering Design, January: 181–192.

IBM. 2019. Personality Insights Documentation. 1 3.

https://console.bluemix.net/docs/services/personality-insights/index.html.

—. 2019. Tone Analyzer Documentation. 1 3.

https://console.bluemix.net/docs/services/tone-analyzer/index.html#about.

Iliadis, Andrew, and Federica Russo. 2016. "Critical data studies: An introduction."

Big Data & Society, July-December: 1–7.

Kirk, Andy, interview by Moritz Stephaner and Enrico Bertini. 2018. Datastories: A

New Generation of DataViz Tools (December 6).

Koponen, Juuso, Jonatan Hildén, and Tapio Vapaasalo. 2016. Tieto näkyväksi.

Helsinki: Aalto ARTS Books.

Kosara, Robert. 2007. "Visualization Criticism – The Missing Link Between

Information Visualization and Art." 2007 11th International Conference

Information Visualization (IV '07). Zürich. 631-636.
Kreeger, Nick. 2019. Visualizing ML training using TensorFlow.js and Baseball data.

January 10. https://beta.observablehq.com/@nkreeger/visualizing-ml-

training-using-tensorflow-js-and-baseball-d.

Krippendorff, Klaus. 2006. The Semantic Turn: A New Foundation For Design. Boca

Raton: CRC Press.

Lupi, Giorgia. 2017. "Data Humanism: The Revolutionary Future of Data

Visualization." Print Mag. January 30.

https://www.printmag.com/information-design/data-humanism-future-of-

data-visualization/.

MacKinlay, Jock. 1986. "Automating the Design of Graphical Presentations of

Relational Information." ACM Transactions on Graphics, April: 110-141.

Malpass, Matt. 2017. Critical Design in Context: History, Theory, and Practices.

London, New York: Bloomsbury Academic.

Manovich, Lev. 2002. "Data Visualization as New Abstraction and Anti-Sublime."

Manovich, Lev. 2011. "What is visualisation?" Visual Studies 26 (1): 36-49.

Mazé, Ramia, and Johan Redström. 2009. "Difficult Forms: Critical Practices of

Design and Research." Research Design Journal 1: 28–39.

Meeks, Elijah. 2018. 3rd Wave Data Visualization: Understanding the convergence of

tools, audiences and modes. December 7.

https://towardsdatascience.com/3rd-wave-data-visualization-824c5dc84967.

—. 2018. Keynote at Tapestry 2018: Third Wave Data Visualization. December 7.

https://www.youtube.com/watch?v=itChfcTx7ao.
Merriam-Webster. 2019. apophenia. January 10. https://www.merriam-

webster.com/dictionary/apophenia.

—. 2019. visualization. January 3. https://www.merriam-

webster.com/dictionary/visualization.

Microsoft. 2019. Text Analytics API Documentation . 1 3.

https://docs.microsoft.com/en-us/azure/cognitive-services/text-analytics/.

Morozov, Evgeny. 2014. To Save Everything, Click Here: The Folly of Technological

Solutionism. New York: PublicAffairs.

Nielsen, Michael A. 2015. Neural Networks and Deep Learning. Determination Press.

Pavliscak, Pamela. 2018. Emotionally Intelligent Design. Sebastopol: O'Reilly Media.

—. 2018. The future of AI is emotionally intelligent. Septermber 22. Accessed January

15, 2019. https://slideslive.com/38910585/the-future-of-ai-is-emotionally-

intelligent.

Posavec, Stefanie. 2019. Dear Data . January 8.

http://www.stefanieposavec.com/dear-data-about/.

—. 2016. Stephanie Posavec: Fragmented portraits in data & drawings . September

25. https://www.youtube.com/watch?v=LVQNzoNIv-8.

Rissanen, Markus. 2017. Basic Forms and Nature: From Visual Simplicity to

Conceptual Complexity. Helsinki: The Academy of Fine Arts at the

University of the Arts Helsinki.

Samuel, Alexandra. 2018. Amazon’s Mechanical Turk has Reinvented Research. May

15. https://daily.jstor.org/amazons-mechanical-turk-has-reinvented-research/.
Steyerl, Hito. 2018. "A Sea of Data: Pattern Recognition and Corporate Animism

(Forked Version)." In Pattern Discrimination, by Clemens Apprich, Florian

Cramer, Wendy Hui Kyong Chun and Hito Steyerl, 1–22. Minnesota;

London: University of Minnesota Press; Meson Press.

The TREsPASS Project. 2019. The TREsPASS Project. January 8.

https://www.trespass-project.eu/.

Torban, Alli, Cole Nussbaumer Knaflic, and Jonathan Schwabish, interview by Moritz

Stephaner and Enrico Bertini. 2018. Data Stories: Year Review 2018

(December 19).

Warden, Pete. 2018. Why you need to improve your training data, and how to do it.

May 28. https://petewarden.com/2018/05/28/why-you-need-to-improve-your-

training-data-and-how-to-do-it/.

Ware, Colin. 2004. Information Visualization: Perception for Design. San Francisco:

Morgan Kaufmann Publishers.

Wickham, Hadley. 2010. "A layered grammar of graphics." Journal of Computational

and Graphical Statistics 19 (1): 3–28.

Wilkinson, Leland. 2005. The Grammar of Graphics. New York: Springer

Science+Business Media, Inc.

Zhou, Haotian, and Ayelet Fisbach. 2016. "The Pitfall of Experimenting on the Web:

How Unattended Selective Attrition Leads to Surprising (Yet False) Research

Conclusions." Journal of Personality and Social Psychology 493–504.
Zimmerman, John, and Jodi Forlizzi. 2014. "Research Through Design in HCI." In

Ways of Knowing in HCI, by J.S. (eds) Olson and W.A. Kellogg, 167–189.

New York: Springer Science+Business Media.
